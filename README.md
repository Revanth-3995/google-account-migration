# Google Account Migration Tool (Drive & Photos)

A local, privacy-first storage manager and rebalancing application for personal Google Drive and Google Photos accounts.

---

## 🎯 Architecture Invariants
* **Google Drive:** 100% Server-to-Server zero data plane copy via Google Drive API under `https://www.googleapis.com/auth/drive.file`. (0 local file bytes).
* **Google Photos:** In-memory ephemeral RAM stream relay (0 disk writes) under `https://www.googleapis.com/auth/photospicker.mediaitems.readonly` (Source) and `https://www.googleapis.com/auth/photoslibrary.appendonly` (Destination).
* **Strict Least-Privilege Scopes:** No restricted scopes (`drive`, `photoslibrary.readonly`, etc.).
* **Safety:** Non-destructive migration (never deletes source files).
* **Localhost Control Plane:** Node.js Express backend, SQLite local database, React + Vite frontend.
* **Production Database:** PostgreSQL via `DATABASE_TYPE=postgres` and `DATABASE_URL` for deployed environments.

---

## 🚀 Quick Start

### 1. Install & Build
```bash
# In the repository root
npm run dev:server    # Starts Express API at http://localhost:3001
npm run dev:client    # Starts Vite React UI at http://localhost:3000
```
Or run the all-in-one production server:
```bash
npm --prefix server start
# Open http://localhost:3001 in your browser
```

---

## 🌐 Beta Deployment

For a controlled private beta, deploy the backend as a single HTTPS Node service and keep the React app served from the same origin when possible.

Recommended environment variables:
```bash
NODE_ENV=production
PORT=3000
DATABASE_TYPE=postgres
DATABASE_URL=postgres://user:password@host:5432/database
FRONTEND_URL=https://your-beta-domain.example
CORS_ORIGIN=https://your-beta-domain.example
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_API_KEY=...
GOOGLE_PROJECT_ID=...
SERVE_CLIENT_DIST=1
```

Deployment notes:
- Use PostgreSQL for production persistence; SQLite remains for local development only.
- Do not commit `credentials.json`, `picker-config.json`, or the database file.
- Keep diagnostics flags off unless explicitly testing:
  - `PHOTOS_TRANSFER_DIAGNOSTICS=0`
  - `PHOTOS_TRANSFER_HASH_DIAGNOSTICS=0`
  - `PHOTOS_IMAGE_VARIANT_TEST=0`
- The beta is safest as a single shared instance for trusted users.

---

## 📁 Repository Structure
```text
google-account-migration/
├── client/                      # React + Vite frontend application
│   ├── src/
│   │   ├── components/          # Navbar, StatCard, Badge, ProgressBar
│   │   ├── pages/               # Dashboard, Accounts, DriveStudio, PhotosStudio, Jobs, History, Settings
│   │   ├── context/             # AppContext & SSE Real-time Telemetry
│   │   └── services/            # Frontend API client
│   └── package.json
│
├── server/                      # Express backend with SQLite/PostgreSQL support
│   ├── src/
│   │   ├── config/              # Credentials loader
│   │   ├── db/                  # Database abstraction + schema initialization
│   │   ├── repositories/        # Account, Job, Item, Audit repositories
│   │   ├── services/            # Auth, Drive, Photos services
│   │   ├── engines/             # DriveMigrationEngine & PhotosMigrationEngine
│   │   ├── jobs/                # JobQueue & concurrency controller
│   │   ├── controllers/         # REST controllers
│   │   ├── routes/              # Express API & SSE /api/events route
│   │   └── server.js            # Express app bootstrap
│   └── package.json
│
├── docs/                        # Validation reports and architecture specs
└── poc/                         # All 5 empirically verified POC harnesses
```
