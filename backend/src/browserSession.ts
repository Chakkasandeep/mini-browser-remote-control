import { chromium, Browser, Page } from "playwright-core";
import { Server } from "socket.io";
import { config } from "./config.js";
import { DockerManager } from "./dockerManager.js";
import { BrowserStatus, ControlEvent, StatusPayload } from "./types.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

export class BrowserSession {
  private status: BrowserStatus = "browser_stopped";
  private message = "Browser Stopped";
  private browser: Browser | null = null;
  private page: Page | null = null;
  private streamTimer: NodeJS.Timeout | null = null;
  private streaming = false;

  constructor(
    private readonly io: Server,
    private readonly dockerManager: DockerManager
  ) {}

  getStatus(): StatusPayload {
    return {
      status: this.status,
      message: this.message,
      viewport: {
        width: config.viewportWidth,
        height: config.viewportHeight
      },
      screenshotIntervalMs: config.screenshotIntervalMs,
      url: this.page ? this.page.url() : ""
    };
  }

  async start() {
    if (this.status === "browser_ready") return this.getStatus();
    this.setStatus("container_starting", "Container Starting");

    try {
      await this.dockerManager.startContainer((message) => {
        this.setStatus("container_starting", message);
      });
      await this.connectToChromium();
      this.setStatus("browser_ready", "Browser Ready");
      this.startStreaming();
      return this.getStatus();
    } catch (error) {
      const containerLogs = await this.dockerManager.getContainerLogs();
      await this.stop();
      const baseMessage =
        error instanceof Error ? error.message : "Browser launch failed.";
      const message = containerLogs
        ? `${baseMessage}\nContainer logs:\n${containerLogs}`
        : baseMessage;
      this.setStatus("error", message);
      throw new Error(message);
    }
  }

  async stop() {
    this.stopStreaming();

    try {
      await this.browser?.close();
    } catch {
      // Browser may already be disconnected.
    }

    this.browser = null;
    this.page = null;
    await this.dockerManager.stopContainer();
    this.setStatus("browser_stopped", "Browser Stopped");
    return this.getStatus();
  }

  async handleControlEvent(event: ControlEvent) {
    if (!this.page || this.status !== "browser_ready") return;

    try {
      if (event.type === "mouse_move") {
        await this.page.mouse.move(event.x, event.y);
      }

      if (event.type === "click") {
        await this.page.mouse.click(event.x, event.y, {
          button: event.button ?? "left"
        });
      }

      if (event.type === "double_click") {
        await this.page.mouse.dblclick(event.x, event.y, {
          button: event.button ?? "left"
        });
      }

      if (event.type === "scroll") {
        await this.page.mouse.wheel(event.deltaX, event.deltaY);
      }

      if (event.type === "type" && event.text.length <= 256) {
        await this.page.keyboard.type(event.text);
      }

      if (event.type === "key" && event.key.length <= 64) {
        await this.page.keyboard.press(event.key);
      }

      if (event.type === "navigate" && event.url.length <= 2048) {
        let targetUrl = event.url.trim();
        if (targetUrl) {
          if (!/^https?:\/\//i.test(targetUrl)) {
            const hasSpace = targetUrl.includes(" ");
            const hasDot = targetUrl.includes(".");
            if (!hasDot || hasSpace) {
              targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
            } else {
              targetUrl = `https://${targetUrl}`;
            }
          }
          await this.page.goto(targetUrl, {
            waitUntil: "domcontentloaded",
            timeout: 15000
          }).catch(() => {});
        }
      }

      if (event.type === "back") {
        await this.page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      }

      if (event.type === "forward") {
        await this.page.goForward({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      }

      if (event.type === "reload") {
        await this.page.reload({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      }
    } catch (error) {
      this.io.emit("session:error", {
        message:
          error instanceof Error
            ? error.message
            : "Could not apply browser control event."
      });
    }
  }

  private async connectToChromium() {
    const endpoint = `http://127.0.0.1:${config.chromiumRemotePort}`;
    const versionEndpoint = `${endpoint}/json/version`;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        this.setStatus(
          "container_starting",
          `Waiting for Chromium DevTools (${attempt + 1}/80)...`
        );

        const response = await fetchWithTimeout(versionEndpoint, 2000);
        if (!response.ok) {
          throw new Error(
            `DevTools returned HTTP ${response.status} ${response.statusText}`
          );
        }

        const versionInfo = (await response.json()) as {
          webSocketDebuggerUrl?: string;
        };
        const webSocketDebuggerUrl = versionInfo.webSocketDebuggerUrl?.replace(
          /^ws:\/\/[^/]+/,
          `ws://127.0.0.1:${config.chromiumRemotePort}`
        );

        if (!webSocketDebuggerUrl) {
          throw new Error("DevTools websocket URL is not ready yet.");
        }

        this.setStatus("container_starting", "Connecting Playwright to DevTools...");
        this.browser = await chromium.connectOverCDP(webSocketDebuggerUrl);
        const context =
          this.browser.contexts()[0] ??
          (await this.browser.newContext({
            viewport: {
              width: config.viewportWidth,
              height: config.viewportHeight
            }
          }));

        this.page = context.pages()[0] ?? (await context.newPage());
        this.page.on("framenavigated", () => {
          this.io.emit("browser:status", this.getStatus());
        });
        this.setStatus("container_starting", "Preparing browser viewport...");
        await this.page.setViewportSize({
          width: config.viewportWidth,
          height: config.viewportHeight
        });
        this.setStatus("container_starting", "Opening default page...");
        await this.page.goto("https://example.com", {
          waitUntil: "domcontentloaded",
          timeout: 15000
        });
        this.browser.on("disconnected", () => {
          this.stop()
            .then(() => {
              this.setStatus("error", "Browser disconnected.");
            })
            .catch(() => {
              this.setStatus("error", "Browser disconnected.");
            });
        });
        return;
      } catch (error) {
        lastError = error;
        await sleep(750);
      }
    }

    throw new Error(
      lastError instanceof Error
        ? `Browser launch failure: ${lastError.message}`
        : "Browser launch failure."
    );
  }

  private startStreaming() {
    if (this.streaming) return;
    this.streaming = true;

    const capture = async () => {
      if (!this.page || this.status !== "browser_ready") return;

      try {
        const image = await this.page.screenshot({
          type: "jpeg",
          quality: config.screenshotQuality,
          animations: "disabled"
        });

        this.io.emit("browser:frame", {
          image,
          mimeType: "image/jpeg",
          width: config.viewportWidth,
          height: config.viewportHeight,
          timestamp: Date.now()
        });
      } catch (error) {
        this.io.emit("session:error", {
          message:
            error instanceof Error
              ? `Screenshot failure: ${error.message}`
              : "Screenshot failure."
        });
      } finally {
        if (this.streaming) {
          this.streamTimer = setTimeout(capture, config.screenshotIntervalMs);
        }
      }
    };

    void capture();
  }

  private stopStreaming() {
    this.streaming = false;
    if (this.streamTimer) clearTimeout(this.streamTimer);
    this.streamTimer = null;
  }

  private setStatus(status: BrowserStatus, message: string) {
    this.status = status;
    this.message = message;
    this.io.emit("browser:status", this.getStatus());
  }
}
