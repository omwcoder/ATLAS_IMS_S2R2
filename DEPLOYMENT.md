# S2R2 Inventory — Local Deployment Guide

**Full local setup: PostgreSQL 17 + Express backend + Next.js frontend**
Built by Civitas Atlas Technologies Pvt. Ltd., Pune, India

---

## System Requirements

| Component | Minimum |
|-----------|---------|
| OS | Windows 10/11, macOS 12+, Ubuntu 20.04+ |
| Node.js | 18.0.0+ |
| npm | 9.0.0+ |
| PostgreSQL | 17 (local install) |
| RAM | 4 GB |
| Disk | 500 MB free |

---

## Full Setup from Scratch

### Step 1 — Install Prerequisites

**Node.js 18+**
Download from [nodejs.org](https://nodejs.org) → LTS version

**PostgreSQL 17**
Download from [postgresql.org/download](https://www.postgresql.org/download/)
- During install: note the `postgres` superuser password
- Default port: 5432
- pgAdmin 4 is included — use it to verify installation

Verify installs:
```powershell
node --version    # v18.x.x or higher
npm --version     # 9.x.x or higher
psql --version    # psql (PostgreSQL) 17.x
```

---

### Step 2 — Clone / Extract the Project

```powershell
# If cloning from GitHub
git clone https://github.com/OM-WADHANE/S2R2_IMS.git
cd S2R2_IMS
```

Or extract the project zip into a folder of your choice.

---

### Step 3 — Set Up the Database

See `DATABASE.md` for full details. Quick version:

```powershell
# Run as postgres superuser
psql -U postgres -h 127.0.0.1 -f backend/setup-local-db.sql

# Or use the PowerShell script
cd backend
.\create-local-db.ps1
```

This creates:
- User: `s2r2_user` / password: `s2r2pass`
- Database: `s2r2_inventory`

---

### Step 4 — Backend Setup

```powershell
cd backend

# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# .env is pre-configured for local PostgreSQL — no changes needed

# 3. Create tables and seed data
npm run db:setup
# This runs: prisma db push + node prisma/seed.js

# 4. Start the backend
npm run dev
# Runs on http://localhost:4000
```

Verify backend is running:
```powershell
Invoke-RestMethod http://localhost:4000/health
# Returns: { status: "ok", trial: { ... } }
```

---

### Step 5 — Frontend Setup

Open a **new terminal window**:

```powershell
cd frontend

# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.local.example .env.local
# Pre-configured: NEXT_PUBLIC_API_URL=http://localhost:4000

# 3. Start the frontend
npm run dev
# Runs on http://localhost:3000
```

---

### Step 6 — Open in Browser

Navigate to: **http://localhost:3000**

Login with:

| Username | Password | Role |
|----------|----------|------|
| `sandeep` | `Sandeep@2025` | ADMIN |
| `rohan` | `Rohan@2025` | ADMIN |
| `akshay` | `Akshay@2025` | ADMIN |
| `emp1` | `Emp1@2025` | EDITOR |
| `emp2` | `Emp2@2025` | EDITOR |
| `emp3` | `Emp3@2025` | EDITOR |
| `emp4` | `Emp4@2025` | EDITOR |
| `emp5` | `Emp5@2025` | EDITOR |

---

## Running Both Servers

Backend and frontend must both be running at the same time.

**Terminal 1 — Backend:**
```powershell
cd backend
npm run dev
# Listening on http://localhost:4000
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm run dev
# Listening on http://localhost:3000
```

The frontend proxies all `/api/*` requests to the backend via `next.config.js` rewrites — no CORS issues locally.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://s2r2_user:s2r2pass@localhost:5432/s2r2_inventory` | PostgreSQL connection |
| `PORT` | `4000` | Express server port |
| `NODE_ENV` | `development` | Environment mode |
| `JWT_SECRET` | `s2r2IOT` | Token signing secret |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |
| `OWNER_SIG` | (fixed) | Ownership HMAC — do not modify |
| `GROQ_API_KEY` | (your key) | Groq AI for Civi AI narrative (optional) |
| `TRIAL_LICENSE_KEY` | `Civitas@admin0919` | License key |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API base URL |

---

## Project Structure

```
s2r2-inventory/
├── README.md               Project overview and quick start
├── DATABASE.md             PostgreSQL 17 setup + Prisma guide
├── DEPLOYMENT.md           This file — full local deployment guide
│
├── backend/
│   ├── server.js           Express entry point
│   ├── package.json        Scripts + dependencies
│   ├── .env                Local environment variables (not in git)
│   ├── .env.example        Template for .env
│   ├── README.md           Backend API reference
│   ├── test-connection.js  DB connectivity test utility
│   │
│   ├── prisma/
│   │   ├── schema.prisma   Database schema (all 8 models)
│   │   ├── seed.js         Seed script — users, materials, products, clients, BOM
│   │   ├── README.md       Full Prisma + schema reference
│   │   └── migrations/     Migration history (auto-generated)
│   │
│   └── src/
│       ├── middleware/
│       │   ├── auth.js         JWT authentication guard
│       │   ├── integrity.js    Ownership & env integrity check
│       │   ├── security.js     Rate limiting, request validation
│       │   └── trial.js        License / trial expiry guard
│       └── routes/
│           ├── auth.js         POST /api/auth/login
│           ├── rawMaterials.js GET/POST/PUT/DELETE /api/raw-materials
│           ├── finishedProducts.js
│           ├── clients.js
│           ├── manufacture.js  BOM, produce, inward, outward, transactions
│           ├── dashboard.js    GET /api/dashboard/stats
│           ├── activity.js     GET /api/activity
│           ├── iotDevices.js   GET/POST/PUT/DELETE /api/iot-devices
│           ├── users.js        GET/POST/PUT/DELETE /api/users (ADMIN)
│           ├── intelligence.js Civi AI — GET /api/intelligence, POST /chat
│           └── trial.js        POST /api/trial/activate
│
├── frontend/
│   ├── next.config.js      API proxy rewrites
│   ├── .env.local          Frontend env (not in git)
│   ├── .env.local.example  Template
│   ├── README.md           Frontend reference
│   │
│   ├── app/                Next.js App Router pages
│   ├── components/         Reusable UI components
│   ├── lib/                API client, hooks, utilities
│   └── types/              TypeScript interfaces
│
├── backend/setup-local-db.sql      SQL script to create DB + user
└── backend/create-local-db.ps1    PowerShell script for Windows
```

---

## Available npm Scripts

### Backend (`cd backend`)

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `nodemon server.js` | Dev server with auto-restart |
| `npm run start` | `node server.js` | Production server |
| `npm run db:push` | `prisma db push` | Sync schema to DB |
| `npm run db:migrate` | `prisma migrate dev` | Create + apply named migration |
| `npm run db:seed` | `node prisma/seed.js` | Seed all data |
| `npm run db:setup` | `db:push + db:seed` | First-time full setup |
| `npm run db:reset` | `prisma migrate reset --force` | Wipe all + re-seed |
| `npm run db:studio` | `prisma studio` | Visual DB browser at :5555 |
| `npm run build` | `prisma generate` | Regenerate Prisma client |
| `npm run test` | `node test-routes.js` | Run API route tests |

### Frontend (`cd frontend`)

| Script | Command | Description |
|--------|---------|-------------|
| `npm run dev` | `next dev` | Dev server at :3000 |
| `npm run build` | `next build` | Production build |
| `npm run start` | `next start` | Serve production build |
| `npm run lint` | `next lint` | ESLint check |

---

## Verification Checklist

After full setup, verify everything works:

```powershell
# 1. Backend health
Invoke-RestMethod http://localhost:4000/health
# Expected: { status: "ok" }

# 2. Login API
$body = '{"username":"sandeep","password":"Sandeep@2025"}'
Invoke-RestMethod -Uri http://localhost:4000/api/auth/login -Method POST -ContentType "application/json" -Body $body
# Expected: { token: "eyJ...", username: "sandeep", role: "ADMIN" }

# 3. DB connection test
cd backend
node test-connection.js
# Expected: all 8 tables confirmed, 8 users, seed data verified

# 4. Frontend
# Open http://localhost:3000 in browser
# Login with sandeep / Sandeep@2025
# Dashboard should show stats and data
```

---

## Resetting Everything

If you need a completely fresh start:

```powershell
cd backend

# Wipe all tables and re-seed
npm run db:reset
# This runs: prisma migrate reset --force (prompts confirmation)
# Then automatically runs seed.js
```

Or if you want to only wipe data and keep tables:

```sql
-- In psql connected to s2r2_inventory
TRUNCATE users, raw_materials, finished_products, bill_of_materials,
         inventory_transactions, clients, iot_devices, activity_logs
         RESTART IDENTITY CASCADE;
```

Then re-seed:
```powershell
npm run db:seed
```

---

## Ports Used

| Service | Port | URL |
|---------|------|-----|
| Frontend (Next.js) | 3000 | http://localhost:3000 |
| Backend (Express) | 4000 | http://localhost:4000 |
| PostgreSQL | 5432 | localhost:5432 |
| Prisma Studio | 5555 | http://localhost:5555 |

Make sure no other services are running on these ports.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| White screen on login | Backend not running | Start `npm run dev` in `backend/` |
| `Invalid username or password` | Wrong credentials or DB not seeded | Run `npm run db:seed` |
| `CORS error` in browser console | `FRONTEND_URL` mismatch in backend `.env` | Check `FRONTEND_URL=http://localhost:3000` |
| `P1001: Can't reach database` | PostgreSQL stopped | `Start-Service postgresql-x64-17` |
| `INTEGRITY VIOLATION — LOCKED` | Missing env var | Check all required vars in `backend/.env` |
| `TRIAL_EXPIRED` | License key expired | Use a valid key in `TRIAL_LICENSE_KEY` |
| Port 3000 in use | Another process | Change port: `npm run dev -- -p 3001` |
| Port 4000 in use | Another backend instance | Kill the process: `Stop-Process -Name node` |
| `MODULE_NOT_FOUND` | Missing install | Run `npm install` in the affected folder |

---

## License Keys

| Key | Plan | Expiry |
|-----|------|--------|
| `Civitas@admin0919` | 1-month | 2026-09-19 |
| `Civitas@admin0219` | 6-month | 2027-02-19 |
| `Civitas@admin0819` | 1-year | 2027-08-19 |

Set in `backend/.env`:
```env
TRIAL_LICENSE_KEY=Civitas@admin0919
```

Or to fully disable the trial gate:
```env
TRIAL_ENABLED=false
```

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India*
*civitasatlasco@gmail.com*
