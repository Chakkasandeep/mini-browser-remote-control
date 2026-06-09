"use client";

import { KeyboardEvent, PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Circle, MousePointer2, Play, Power, RotateCw, Square, Wifi, WifiOff } from "lucide-react";
import { io, Socket } from "socket.io-client";

type BrowserStatus = "browser_stopped" | "container_starting" | "browser_ready" | "error";

type StatusPayload = {
  status: BrowserStatus;
  message: string;
  viewport: {
    width: number;
    height: number;
  };
  screenshotIntervalMs: number;
  url?: string;
};

type FramePayload = {
  image: ArrayBuffer;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  timestamp: number;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

const statusLabel: Record<BrowserStatus, string> = {
  browser_stopped: "Browser Stopped",
  container_starting: "Container Starting",
  browser_ready: "Browser Ready",
  error: "Error"
};

export default function Home() {
  const [status, setStatus] = useState<StatusPayload>({
    status: "browser_stopped",
    message: "Browser Stopped",
    viewport: { width: 1280, height: 720 },
    screenshotIntervalMs: 200,
    url: ""
  });
  const [frameUrl, setFrameUrl] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lastMoveRef = useRef(0);

  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ["websocket"]
    });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("browser:status", (payload: StatusPayload) => {
      setStatus(payload);
      if (payload.url) setUrlInput(payload.url);
    });
    socket.on("session:error", (payload: { message: string }) => setError(payload.message));
    socket.on("browser:frame", (payload: FramePayload) => {
      const blob = new Blob([payload.image], { type: payload.mimeType });
      const nextUrl = URL.createObjectURL(blob);
      setFrameUrl((oldUrl) => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return nextUrl;
      });
    });

    void fetch(`${backendUrl}/status`)
      .then((res) => res.json())
      .then((payload: StatusPayload) => {
        setStatus(payload);
        if (payload.url) setUrlInput(payload.url);
      })
      .catch(() => setError("Backend is not reachable."));

    return () => {
      socket.disconnect();
      setFrameUrl((oldUrl) => {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
        return "";
      });
    };
  }, []);

  const startBrowser = async () => {
    setError("");
    try {
      const response = await fetch(`${backendUrl}/start-browser`, { method: "POST" });
      const payload = await response.json();
      setStatus(payload);
      if (payload.url) setUrlInput(payload.url);
      if (!response.ok) setError(payload.message ?? "Could not start browser.");
    } catch {
      setError(`Backend is not reachable at ${backendUrl}. Open http://localhost:3000 and confirm http://localhost:4000/status works.`);
    }
  };

  const stopBrowser = async () => {
    setError("");
    try {
      const response = await fetch(`${backendUrl}/stop-browser`, { method: "POST" });
      const payload = await response.json();
      setStatus(payload);
    } catch {
      setError(`Backend is not reachable at ${backendUrl}.`);
    }
  };

  const scaledPoint = (event: PointerEvent<HTMLImageElement>) => {
    const image = imageRef.current;
    if (!image) return null;
    const rect = image.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * status.viewport.width);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * status.viewport.height);
    return {
      x: Math.max(0, Math.min(status.viewport.width - 1, x)),
      y: Math.max(0, Math.min(status.viewport.height - 1, y))
    };
  };

  const emitControl = (payload: object) => {
    socketRef.current?.emit("browser:control", payload);
  };

  const navigateToUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    emitControl({ type: "navigate", url: urlInput.trim() });
  };

  const navBack = () => {
    emitControl({ type: "back" });
  };

  const navForward = () => {
    emitControl({ type: "forward" });
  };

  const navReload = () => {
    emitControl({ type: "reload" });
  };

  const onPointerMove = (event: PointerEvent<HTMLImageElement>) => {
    if (status.status !== "browser_ready") return;
    const now = performance.now();
    if (now - lastMoveRef.current < 50) return;
    lastMoveRef.current = now;
    const point = scaledPoint(event);
    if (point) emitControl({ type: "mouse_move", ...point });
  };

  const onClick = (event: PointerEvent<HTMLImageElement>) => {
    if (status.status !== "browser_ready") return;
    const panel = document.querySelector(".browserPanel") as HTMLDivElement | null;
    if (panel) panel.focus();

    const point = scaledPoint(event);
    if (!point) return;

    let button: "left" | "right" | "middle" = "left";
    if (event.button === 1) button = "middle";
    if (event.button === 2) button = "right";

    emitControl({ type: "click", ...point, button });
  };

  const onDoubleClick = (event: PointerEvent<HTMLImageElement>) => {
    if (status.status !== "browser_ready") return;
    const point = scaledPoint(event);
    if (!point) return;

    let button: "left" | "right" | "middle" = "left";
    if (event.button === 1) button = "middle";
    if (event.button === 2) button = "right";

    emitControl({ type: "double_click", ...point, button });
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (status.status !== "browser_ready") return;
    event.preventDefault();
    emitControl({ type: "scroll", deltaX: event.deltaX, deltaY: event.deltaY });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (status.status !== "browser_ready") return;

    if (event.key.length === 1) {
      emitControl({ type: "type", text: event.key });
      return;
    }

    const keyMap: Record<string, string> = {
      " ": "Space",
      ArrowUp: "ArrowUp",
      ArrowDown: "ArrowDown",
      ArrowLeft: "ArrowLeft",
      ArrowRight: "ArrowRight",
      Backspace: "Backspace",
      Delete: "Delete",
      Enter: "Enter",
      Escape: "Escape",
      Tab: "Tab"
    };

    const mapped = keyMap[event.key];
    if (mapped) {
      event.preventDefault();
      emitControl({ type: "key", key: mapped });
    }
  };

  const ready = status.status === "browser_ready";

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Local Browser Control</p>
          <h1>Mini Remote Chromium</h1>
        </div>
        <div className="connection" title={connected ? "Socket connected" : "Socket disconnected"}>
          {connected ? <Wifi size={18} /> : <WifiOff size={18} />}
          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </section>

      <section className="controls">
        <button className="primary" onClick={startBrowser} disabled={status.status === "container_starting"}>
          <Play size={18} />
          Start Browser
        </button>
        <button className="secondary" onClick={stopBrowser}>
          <Square size={18} />
          Stop Browser
        </button>
        <div className={`status ${status.status}`}>
          <Circle size={12} fill="currentColor" />
          <span>{status.status === "container_starting" ? status.message : statusLabel[status.status]}</span>
        </div>
        <div className="metric">
          <Power size={16} />
          {status.viewport.width}x{status.viewport.height} · {status.screenshotIntervalMs} ms
        </div>
      </section>

      {ready && (
        <form className="browserNav" onSubmit={navigateToUrl}>
          <button type="button" className="navBtn" onClick={navBack} title="Back">
            <ArrowLeft size={16} />
          </button>
          <button type="button" className="navBtn" onClick={navForward} title="Forward">
            <ArrowRight size={16} />
          </button>
          <button type="button" className="navBtn" onClick={navReload} title="Reload">
            <RotateCw size={15} />
          </button>
          <div className="addressBarContainer">
            <input
              type="text"
              className="addressInput"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter URL to navigate (e.g. google.com)"
            />
          </div>
          <button type="submit" className="goBtn">
            Go
          </button>
        </form>
      )}

      <section
        className="browserPanel"
        tabIndex={0}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        aria-label="Remote browser display"
      >
        {frameUrl ? (
          <img
            ref={imageRef}
            src={frameUrl}
            alt="Remote browser stream"
            draggable={false}
            onPointerMove={onPointerMove}
            onPointerDown={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
          />
        ) : (
          <div className="emptyState">
            <MousePointer2 size={34} />
            <span>{status.message}</span>
          </div>
        )}
        {!ready && frameUrl ? <div className="overlay">{status.message}</div> : null}
      </section>

      {error ? <div className="error">{error}</div> : null}
    </main>
  );
}
