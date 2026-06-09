# API Documentation

Base URL:

```text
http://localhost:4000
```

## GET /health

Returns backend health.

Response:

```json
{
  "ok": true
}
```

## GET /status

Returns current browser state.

Response:

```json
{
  "status": "browser_stopped",
  "message": "Browser Stopped",
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "screenshotIntervalMs": 200
}
```

Status values:

- `container_starting`
- `browser_ready`
- `browser_stopped`
- `error`

## POST /start-browser

Starts the Docker container, connects Playwright, and starts streaming frames.

Response:

```json
{
  "status": "browser_ready",
  "message": "Browser Ready",
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "screenshotIntervalMs": 200
}
```

## POST /stop-browser

Stops streaming, disconnects Playwright, and removes the Docker container.

Response:

```json
{
  "status": "browser_stopped",
  "message": "Browser Stopped",
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "screenshotIntervalMs": 200
}
```

## Socket.IO Events

### browser:status

Backend to frontend. Emits the same payload as `GET /status`.

### browser:frame

Backend to frontend.

```ts
{
  image: ArrayBuffer;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  timestamp: number;
}
```

### browser:control

Frontend to backend.

```ts
{ type: "mouse_move"; x: number; y: number }
{ type: "click"; x: number; y: number; button?: "left" | "right" | "middle" }
{ type: "double_click"; x: number; y: number; button?: "left" | "right" | "middle" }
{ type: "scroll"; deltaX: number; deltaY: number }
{ type: "type"; text: string }
{ type: "key"; key: string }
```

### session:error

Backend to frontend.

```json
{
  "message": "Screenshot failure: ..."
}
```

