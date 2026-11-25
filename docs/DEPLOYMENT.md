# HabitFlow Production Deployment & Operations Guide

## 1. Single-Host Node Production Mode
Build the React SPA bundle and serve both the frontend and REST API from Express on a single port:

```bash
npm run install:all
npm run build
npm start
```
- Application & API available at: `http://localhost:5001`
- Readiness probe: `http://localhost:5001/api/health`

---

## 2. Docker & Docker Compose Deployment (Recommended Self-Hosted / VPS)
Uses a 3-stage `Dockerfile` (frontend build → native dependency build → minimal non-root runtime) with a named volume for persistent SQLite storage:

```bash
docker compose up -d --build
```
- Verify health status: `docker ps` (includes built-in `HEALTHCHECK` polling `/api/health`)
- Persistent database path inside volume: `/data/habitflow.db`

---

## 3. Cloud PaaS Deployment (Render / Railway / Fly.io)
> **Important:** Because SQLite stores data in a local `.db` file + WAL journal, deploy on a container/Node host with a **persistent disk volume** (do **not** deploy the backend to ephemeral serverless functions such as Vercel/Netlify Functions).

### Render.com Blueprint (`render.yaml`)
1. Push this repository to GitHub.
2. In Render Dashboard, select **New + → Blueprint** and connect the repository.
3. Render automatically provisions the Docker web service, mounts a persistent disk at `/data`, sets `TRUST_PROXY=true` (enabling `Secure` cookies and `HSTS`), and monitors `/api/health`.

---

## 4. Database Backups & Recovery
Run an online, WAL-safe snapshot backup at any time (even while the server is actively handling traffic):

```bash
npm run db:backup
```
Backups are written to `server/backups/habitflow-backup-<timestamp>.db`. To restore, stop the server, replace `server/data/habitflow.db` (removing any stale `-wal` / `-shm` files), and restart.
