# Installation Guide

## 1. Install prerequisites

Install Docker Desktop and start it before running the backend.

Install Node.js 20.9 or newer. Confirm versions:

```powershell
node --version
npm --version
docker version
```

## 2. Install dependencies

From the project root:

```powershell
npm install
npm run install:all
```

Dependencies are installed locally in:

- `backend/node_modules`
- `frontend/node_modules`
- `node_modules`

No global package installation is required.

## 3. Create environment files

```powershell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env.local
```

## 4. Run in development mode

```powershell
npm run dev
```

Frontend: `http://localhost:3000`

Backend: `http://localhost:4000`

## 5. Production build

```powershell
npm run build
npm run start
```

## About venv

This project is JavaScript/TypeScript only, so a Python virtual environment is not needed. The equivalent isolation is local `node_modules` folders created by `npm install`.
