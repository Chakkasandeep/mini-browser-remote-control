# Architecture Diagram

```mermaid
flowchart LR
  UI["Next.js Frontend\nlocalhost:3000"] -->|POST /start-browser| API["Express API\nlocalhost:4000"]
  UI -->|Socket.IO control events| WS["Socket.IO Server"]
  WS -->|Frames and status| UI
  API --> Manager["Dockerode Container Manager"]
  Manager --> Docker["Docker Desktop"]
  Docker --> Container["Chromium Container\nCDP :9222"]
  API --> Session["Playwright Browser Session"]
  Session -->|connectOverCDP| Container
  Session -->|JPEG screenshots every 200 ms| WS
  WS -->|click, double click, move, type, key, scroll| Session
```

## Components

- **Frontend:** Shows status, renders frames, captures pointer, keyboard, and scroll events.
- **Backend API:** Starts/stops the browser container and reports status.
- **Socket.IO:** Carries compressed screenshot frames and browser control events.
- **Dockerode:** Builds the local Docker image and manages the Chromium container.
- **Playwright:** Connects to Chromium over CDP and applies user controls.

