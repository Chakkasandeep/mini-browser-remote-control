import http from "node:http";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { config } from "./config.js";
import { BrowserSession } from "./browserSession.js";
import { DockerManager } from "./dockerManager.js";
import { ControlEvent } from "./types.js";

const app = express();
const server = http.createServer(app);
const allowedOrigins = new Set([
  config.frontendOrigin,
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);
const corsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void
) => {
  if (!origin || allowedOrigins.has(origin) || /^http:\/\/172\.\d+\.\d+\.\d+:3000$/.test(origin)) {
    callback(null, true);
    return;
  }

  callback(new Error(`Origin ${origin} is not allowed by CORS.`));
};
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 2e6
});

app.use(
  cors({
    origin: corsOrigin
  })
);
app.use(express.json({ limit: "1mb" }));

const dockerManager = new DockerManager();
const browserSession = new BrowserSession(io, dockerManager);

app.get("/", (_req, res) => {
  res.json({
    name: "Mini Browser Remote Control Backend",
    frontend: config.frontendOrigin,
    health: "/health",
    status: "/status",
    startBrowser: "POST /start-browser",
    stopBrowser: "POST /stop-browser"
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/status", (_req, res) => {
  res.json(browserSession.getStatus());
});

app.post("/start-browser", async (_req, res) => {
  try {
    const status = await browserSession.start();
    res.json(status);
  } catch (error) {
    res.status(503).json({
      ...browserSession.getStatus(),
      message:
        error instanceof Error ? error.message : "Could not start browser."
    });
  }
});

app.post("/stop-browser", async (_req, res) => {
  const status = await browserSession.stop();
  res.json(status);
});

io.on("connection", (socket) => {
  socket.emit("browser:status", browserSession.getStatus());

  socket.on("browser:control", (event: ControlEvent) => {
    void browserSession.handleControlEvent(event);
  });

  socket.on("disconnect", () => {
    socket.broadcast.emit("session:peer-disconnected", {
      message: "A browser control client disconnected."
    });
  });
});

process.on("SIGINT", async () => {
  await browserSession.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await browserSession.stop();
  process.exit(0);
});

server.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});
