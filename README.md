# Mini Browser Remote Control System

A local-only remote browser control system (similar to a miniature TeamViewer for a web browser) built using **Next.js**, **Express**, **Socket.IO**, **Dockerode**, and **Playwright**.

---

## Architecture Diagram

```mermaid
flowchart TD
  subgraph Host [Windows Host Machine]
    UI["Next.js Frontend\n(localhost:3000)"]
    API["Express Backend\n(localhost:4000)"]
    WS["Socket.IO WebSocket Server\n(Port 4000)"]
  end

  subgraph LinuxVM [WSL2 / Docker Desktop Namespace]
    subgraph Container [Docker Container: mini-browser-chromium]
      Socat["socat Proxy\n(Binds 0.0.0.0:9222)"]
      Chrome["Headless Chromium\n(Binds 127.0.0.1:9223)"]
    end
  end

  %% API Calls
  UI -->|1. POST /start-browser| API
  UI -->|6. POST /stop-browser| API
  API -->|2. Orchestrates Container| Container

  %% WebSockets
  UI <-->|4. Connects & Syncs Status| WS
  WS -->|browser:frame (JPEG stream)| UI
  UI -->|browser:control (clicks, keys, wheel, navigate)| WS

  %% CDP Debugging Connection
  API -->|3. connectOverCDP| Socat
  Socat -->|Forward TCP| Chrome
  API -->|5. Screenshots & Inputs| Chrome
```

---

## How It Works (System Data Flow)

1. **User Action:** The user opens the Next.js UI on `http://localhost:3000` and clicks the **"Start Browser"** button.
2. **Backend API Initialization:**
   * The frontend fires a `POST /start-browser` request to the Express backend (`http://localhost:4000`).
   * The backend check verifies if the Docker daemon is active.
   * The backend builds the local Chromium Docker image (if not already cached) and starts the container named `mini-browser-chromium`.
3. **Loopback Networking Bypass (socat):**
   * Inside the container, Chromium launches in headless mode and binds its debugging interface to loopback `127.0.0.1:9223`.
   * A background `socat` bridge listens on container interface `0.0.0.0:9222` and tunnels incoming host requests to `127.0.0.1:9223`.
4. **Automation Link:** The Playwright module in the backend negotiates a Chrome DevTools Protocol (CDP) connection to the container at `http://127.0.0.1:9222` and directs the browser to the default starting page.
5. **Real-time Navigation & Interaction Sync:**
   * **Streaming:** The backend runs a timer loop capturing JPEG screenshot buffers at `200ms` intervals and emits them to the frontend via Socket.IO (`browser:frame`).
   * **Interaction Events:** The frontend captures clicks, double-clicks, scroll wheel deltas, keyboard keystrokes, and navigation commands, transmitting them via Socket.IO (`browser:control`).
   * **URL Sync:** When page redirects or clicks occur, the backend page listens to the `framenavigated` event and synchronization pushes URL updates to update the address bar input.
6. **Teardown:** When the user clicks **"Stop Browser"** (or when the CDP connection disconnects unexpectedly), the backend kills the Playwright browser session, stops the Docker container, and removes it cleanly.

---

## Folder Structure

```text
project-root/
├── backend/
│   ├── src/
│   │   ├── browserSession.ts   # Playwright automation, screen streaming, event handlers
│   │   ├── config.ts           # System configs and environment variables
│   │   ├── dockerManager.ts    # Dockerode lifecycle management (ping, build, start, stop)
│   │   ├── server.ts           # Express server endpoints, Socket.IO routes, and CORS setup
│   │   └── types.ts            # Shared TypeScript type definitions
│   ├── package.json            # Node.js backend configuration
│   └── tsconfig.json           # Backend compiler rules
├── docker/
│   └── Dockerfile              # Chromium headless server + socat proxy installation
├── docs/
│   ├── api.md                  # API & Socket events specification
│   ├── architecture.md         # Mermaid flow specifications
│   ├── installation.md         # Detailed local deployment documentation
│   └── troubleshooting.md      # Docker and browser error fixes
├── frontend/
│   ├── app/
│   │   ├── globals.css         # Sleek dark-mode glassmorphic CSS styling
│   │   ├── layout.tsx          # Root layout and metadata tags
│   │   └── page.tsx            # Next.js interactive remote control console
│   ├── package.json            # Next.js frontend configurations
│   └── tsconfig.json           # Frontend compiler rules
├── package.json                # Root concurrently command script orchestrator
└── README.md                   # Complete system overview (this file)
```

---

## Prerequisites

* **OS:** Windows 10 or 11.
* **Node.js:** version `20.9.0` or newer.
* **Docker Desktop:** installed and running.

---

## Installation & Setup

1. **Clone the Repository** and navigate to the project directory:
   ```powershell
   cd "Mini Browser Remote Control System"
   ```

2. **Install Root and Project Dependencies:**
   ```powershell
   npm install
   npm run install:all
   ```

3. **Configure Environment Variables:**
   * Create backend config:
     ```powershell
     copy backend\.env.example backend\.env
     ```
   * Create frontend config:
     ```powershell
     copy frontend\.env.example frontend\.env.local
     ```

4. **Verify Docker Desktop Daemon is Running:**
   Ensure Docker Desktop is active on your Windows machine. If you need to spin up the daemon from your terminal, run:
   ```powershell
   # Starts the Docker WSL backend distribution
   wsl -d docker-desktop
   
   # Launches the Docker helper process in the background
   powershell -Command "& 'C:\Program Files\Docker\Docker\resources\com.docker.backend.exe'"
   ```

---

## Running the Project Locally

### 1. Run in Development Mode (Recommended)
This starts both the Express server (with hot-reloading) and the Next.js frontend concurrently:
```powershell
npm run dev
```
* **Frontend Access:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:4000](http://localhost:4000)

### 2. Run in Production Mode
Compile the backend TypeScript and optimize the Next.js static build, then start the servers:
```powershell
npm run build
npm run start
```

---

## Controls Reference (Web Console)

* **Start Browser:** Spins up the container, builds the image on first run (takes 5-15 mins to pull dependencies), connects Playwright, and starts the stream.
* **Stop Browser:** Shuts down Chromium and cleanly deletes the container.
* **Address Bar:** Type any URL (e.g. `google.com`) and click **"Go"** or press **Enter** to navigate.
* **Search queries:** Typing a general search phrase (e.g., `youtube`) automatically performs a Google search.
* **Browser Navigation:** Click **Back** (`<-`), **Forward** (`->`), and **Reload** to navigate history.
* **Interaction:** Directly hover, click (left, middle, right-clicks), double-click, type, or scroll the remote webpage inside the container screen.
