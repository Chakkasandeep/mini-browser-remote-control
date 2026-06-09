import Docker, { Container } from "dockerode";
import tar from "tar-fs";
import { config } from "./config.js";

const getDockerOptions = () => {
  if (process.platform === "win32") {
    // Default to the standard Docker Desktop WSL2 pipe
    return { socketPath: "//./pipe/dockerDesktopLinuxEngine" };
  }
  return {};
};

let docker = new Docker(getDockerOptions());
const imageVersionLabel = "mini-browser.image-version";
const requiredImageVersion = "2026-06-08.3";

type ProgressReporter = (message: string) => void;

const waitForBuild = async (
  stream: NodeJS.ReadableStream,
  onProgress?: ProgressReporter
) => {
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (error: Error | null) => (error ? reject(error) : resolve()),
      (event: { stream?: string; status?: string; progress?: string; error?: string }) => {
        if (event.error) {
          onProgress?.(`Docker build error: ${event.error}`);
          return;
        }

        const message = [event.status, event.progress]
          .filter(Boolean)
          .join(" ")
          .trim();
        const streamMessage = event.stream?.trim();
        const nextMessage = message || streamMessage;

        if (nextMessage) onProgress?.(nextMessage);
      }
    );
  });
};

export class DockerManager {
  private container: Container | null = null;

  async ping(onProgress?: ProgressReporter) {
    onProgress?.("Checking Docker Desktop...");
    try {
      await docker.ping();
      onProgress?.("Docker Desktop is running.");
      return;
    } catch (error) {
      if (process.platform === "win32") {
        const currentPath = (docker.modem as any).socketPath;
        const altPath =
          currentPath === "//./pipe/dockerDesktopLinuxEngine"
            ? "//./pipe/docker_engine"
            : "//./pipe/dockerDesktopLinuxEngine";

        try {
          const altDocker = new Docker({ socketPath: altPath });
          await altDocker.ping();
          docker = altDocker;
          onProgress?.("Docker Desktop is running.");
          return;
        } catch {
          // Fall through
        }
      }
    }

    throw new Error(
      "Docker is not reachable. Start Docker Desktop and retry."
    );
  }

  async ensureImage(onProgress?: ProgressReporter) {
    await this.ping(onProgress);

    try {
      onProgress?.(`Checking image ${config.chromiumImage}...`);
      const imageInfo = await docker.getImage(config.chromiumImage).inspect();
      const currentVersion = imageInfo.Config?.Labels?.[imageVersionLabel];
      if (currentVersion === requiredImageVersion) {
        onProgress?.("Chromium Docker image already exists.");
        return;
      }

      onProgress?.("Existing Chromium image is outdated. Rebuilding it...");
      await docker.getImage(config.chromiumImage).remove({ force: true });
    } catch {
      onProgress?.(
        "Building Chromium Docker image. First run can take 5-15 minutes while Docker downloads the base image."
      );
    }

    const tarStream = tar.pack(config.dockerContextPath);
    const buildStream = await docker.buildImage(tarStream, {
      t: config.chromiumImage
    });
    await waitForBuild(buildStream, onProgress);
    onProgress?.("Chromium Docker image build completed.");
  }

  async startContainer(onProgress?: ProgressReporter) {
    await this.ensureImage(onProgress);
    onProgress?.("Removing old Chromium container if it exists...");
    await this.removeExistingContainer();

    const exposedPort = `${config.chromiumRemotePort}/tcp`;
    onProgress?.("Creating Chromium container...");
    this.container = await docker.createContainer({
      Image: config.chromiumImage,
      name: config.chromiumContainerName,
      ExposedPorts: {
        [exposedPort]: {}
      },
      HostConfig: {
        AutoRemove: false,
        Memory: 768 * 1024 * 1024,
        NanoCpus: 1_500_000_000,
        ShmSize: 256 * 1024 * 1024,
        PortBindings: {
          [exposedPort]: [{ HostPort: String(config.chromiumRemotePort) }]
        }
      },
      Env: [
        `VIEWPORT_WIDTH=${config.viewportWidth}`,
        `VIEWPORT_HEIGHT=${config.viewportHeight}`
      ]
    });

    onProgress?.("Starting Chromium container...");
    await this.container.start();
    onProgress?.("Chromium container started. Connecting Playwright...");
    return this.container;
  }

  async stopContainer() {
    const container = this.container ?? (await this.findContainer());
    if (!container) return;

    try {
      await container.stop({ t: 2 });
    } catch {
      // Already stopped containers can be removed below.
    }

    try {
      await container.remove({ force: true });
    } catch {
      // Container removal is best-effort during shutdown.
    }

    this.container = null;
  }

  async isContainerRunning() {
    const container = this.container ?? (await this.findContainer());
    if (!container) return false;

    try {
      const details = await container.inspect();
      return Boolean(details.State.Running);
    } catch {
      return false;
    }
  }

  async getContainerLogs() {
    const container = this.container ?? (await this.findContainer());
    if (!container) return "";

    try {
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        follow: false,
        tail: 40
      });
      return logs.toString("utf8").replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "");
    } catch {
      return "";
    }
  }

  private async findContainer() {
    const containers = await docker.listContainers({ all: true });
    const found = containers.find((item) =>
      item.Names.some((name) => name === `/${config.chromiumContainerName}`)
    );
    return found ? docker.getContainer(found.Id) : null;
  }

  private async removeExistingContainer() {
    const existing = await this.findContainer();
    if (!existing) return;

    try {
      await existing.remove({ force: true });
    } catch {
      throw new Error("Could not remove the existing Chromium container.");
    }
  }
}
