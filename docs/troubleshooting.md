# Troubleshooting Guide

## Docker is not running

Symptom:

```text
Docker is not reachable. Start Docker Desktop and retry.
```

Fix:

1. Open Docker Desktop.
2. Wait until Docker says it is running.
3. Run `docker version`.
4. Click **Start Browser** again.

## Container port already in use

Symptom:

```text
Bind for 0.0.0.0:9222 failed
```

Fix:

Stop anything using port `9222`, or change `CHROMIUM_REMOTE_PORT` in `backend/.env`.

## Browser launch failure

Symptom:

```text
Browser launch failure
```

Fix:

Run:

```powershell
docker ps -a
docker logs mini-browser-chromium
```

Then stop and restart:

```powershell
docker rm -f mini-browser-chromium
npm run dev
```

## Screenshot failure

Screenshot failures usually mean Chromium crashed or Playwright disconnected. Click **Stop Browser**, then **Start Browser**.

For slower laptops, increase:

```env
SCREENSHOT_INTERVAL_MS=300
SCREENSHOT_QUALITY=50
```

## WebSocket disconnect

If the UI says disconnected:

1. Confirm backend is running at `http://localhost:4000/health`.
2. Refresh the frontend page.
3. Check that `NEXT_PUBLIC_BACKEND_URL` matches the backend URL.

## High CPU usage

Use CPU-friendly settings:

```env
SCREENSHOT_INTERVAL_MS=300
SCREENSHOT_QUALITY=50
BROWSER_VIEWPORT_WIDTH=1280
BROWSER_VIEWPORT_HEIGHT=720
```

Avoid increasing the stream above 5 frames per second on low-power laptops.

