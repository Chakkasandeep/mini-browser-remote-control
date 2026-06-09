import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

const intFromEnv = (name: string, fallback: number) => {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const config = {
  port: intFromEnv("PORT", 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  chromiumImage: process.env.CHROMIUM_IMAGE ?? "mini-browser-chromium:latest",
  chromiumContainerName:
    process.env.CHROMIUM_CONTAINER_NAME ?? "mini-browser-chromium",
  chromiumRemotePort: intFromEnv("CHROMIUM_REMOTE_PORT", 9222),
  viewportWidth: intFromEnv("BROWSER_VIEWPORT_WIDTH", 1280),
  viewportHeight: intFromEnv("BROWSER_VIEWPORT_HEIGHT", 720),
  screenshotIntervalMs: Math.max(
    100,
    intFromEnv("SCREENSHOT_INTERVAL_MS", 200)
  ),
  screenshotQuality: Math.min(
    90,
    Math.max(35, intFromEnv("SCREENSHOT_QUALITY", 60))
  ),
  dockerContextPath: path.resolve(
    backendRoot,
    process.env.DOCKER_CONTEXT_PATH ?? "../docker"
  )
};

