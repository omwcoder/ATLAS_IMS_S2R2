# S2R2 Inventory — Deployment Guide

Two environments covered:
- **Local Development** — PostgreSQL 17 + Express + Next.js on your machine
- **Production** — Neon DB + Railway (backend) + Vercel (frontend)

---

## PART 1 — Local Development

### Requirements

| Tool | Version |
|------|---------|
| Node.js | 18+ |
| PostgreSQL | 17 |
| npm | 9+ |

---

### Step 1 — Database

See **DATABASE.md** for full options. Quick version:

```powershell
psql -U postgres -h 127.0.0.1 -f backend/setup-local-db.sql
```

Creates: `s2r2_inventory` database, `s2r2_user` / `s2r2pass`

---

### Step 2 — Backend

```bash
cd backend
cp .env.example .env      # pre-configured for local PostgreSQL
npm install
npm run db:setup          # creates tables + seeds all data
npm run dev               # http://localhost:4000
```

Verify:
```powershell
Invoke-RestMethod http://localhost:4000/health
# { "status": "ok", "trial": { ... } }
```

---

### Step 3 — Frontend

Open a new terminal:

```bash
cd frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                        # http://localhost:3000
```

---

### Step 4 — Login

Open **http://localhost:3000**

```
Username: sandeep
Password: Sandeep@2025
Role:     ADMIN
```

---

### Local Ports

| Service       | Port | URL                     |
|---------------|------|-------------------------|
| Frontend      | 3000 | http://localhost:3000    |
| Backend API   | 4000 | http://localhost:4000    |
| PostgreSQL    | 5432 | localhost:5432           |
| Prisma Studio | 5555 | http://localhost:5555    |

---

## PART 2 — Production (Railway + Vercel + Neon)

### Architecture

```
Browser
  │
  ▼
Vercel (Next.js frontend)
  │  NEXT_PUBLIC_API_URL
  ▼
Railway (Express backend)
  │  DATABASE_URL (pooled)
  │  DIRECT_URL (migrations)
  ▼
Neon (PostgreSQL serverless)
```

---

### Step 1 — Neon Database

1. Create account at [console.neon.tech](https://console.neon.tech)
2. New Project → `s2r2-inventory` → region `ap-southeast-1`
3. Get both connection strings from Connection Details:
   - **Pooled URL** → `DATABASE_URL` (toggle Pooler ON)
   - **Direct URL** → `DIRECT_URL` (toggle Pooler OFF)
4. Run migrations + seed from your local machine:
   ```bash
   cd backend
   # Set DIRECT_URL in .env to Neon direct URL temporarily
   npx prisma migrate deploy
   node prisma/seed.js
   ```

---

### Step 2 — Railway (Backend)

1. Go to [railway.app](https://railway.app) → Login with GitHub
2. New Project → Deploy from GitHub → select `ATLAS_IMS_S2R2`
3. **Settings → Source → Root Directory:** `backend`
4. **Variables tab** — add all 9 variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `JWT_SECRET` | `s2r2IOT` |
| `OWNER_SIG` | `ab33e31dfa52e6d0087078fd205645d09832a8048cc09426c8e759bc8f131ad4` |
| `GROQ_API_KEY` | your Groq API key |
| `TRIAL_LICENSE_KEY` | `Civitas@admin0919` |
| `FRONTEND_URL` | `https://placeholder.vercel.app` (update after Vercel deploy) |

5. Deploy → wait for build (uses Dockerfile with node:20-slim + OpenSSL)
6. **Settings → Networking → Generate Domain** → copy Railway URL
7. Test: `https://YOUR-RAILWAY-URL/health` → `{ "status": "ok" }`

---

### Step 3 — Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → Login with GitHub
2. New Project → Import `ATLAS_IMS_S2R2`
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework:** Next.js (auto-detected)
4. **Environment Variables:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-RAILWAY-URL.up.railway.app` |

5. Deploy → copy Vercel URL

---

### Step 4 — Wire Together

Go back to Railway → Variables → update:
```
FRONTEND_URL = https://YOUR-VERCEL-URL.vercel.app
```

Railway auto-redeploys. Done.

---

### Step 5 — Verify Production

```
Open Vercel URL → login with sandeep / Sandeep@2025
Dashboard loads with data ✓
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Local | Production |
|----------|-------|------------|
| `DATABASE_URL` | `postgresql://s2r2_user:s2r2pass@localhost:5432/s2r2_inventory` | Neon pooled URL |
| `DIRECT_URL` | same as DATABASE_URL (or omit) | Neon direct URL |
| `PORT` | `4000` | `4000` |
| `NODE_ENV` | `development` | `production` |
| `JWT_SECRET` | `s2r2IOT` | `s2r2IOT` |
| `FRONTEND_URL` | `http://localhost:3000` | Vercel URL |
| `OWNER_SIG` | `ab33e31dfa...` | same |
| `GROQ_API_KEY` | your key | your key |
| `TRIAL_LICENSE_KEY` | `Civitas@admin0919` | `Civitas@admin0919` |

### Frontend (`frontend/.env.local`)

| Variable | Local | Production |
|----------|-------|------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Railway URL |

---

## License Keys

| Key | Plan | Expiry |
|-----|------|--------|
| `Civitas@admin0919` | 1-month | 2026-09-19 |
| `Civitas@admin0219` | 6-month | 2027-02-19 |
| `Civitas@admin0819` | 1-year | 2027-08-19 |

To disable trial gate entirely:
```env
TRIAL_ENABLED=false
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| White screen / login fails | Backend not running or `NEXT_PUBLIC_API_URL` wrong |
| `Invalid username or password` | DB not seeded — run `node prisma/seed.js` |
| CORS error in browser | `FRONTEND_URL` on Railway doesn't match Vercel URL |
| `INTEGRITY VIOLATION` | Missing env var in Railway — check all 9 variables |
| `TRIAL_EXPIRED` | Add valid `TRIAL_LICENSE_KEY` to Railway variables |
| `P1001: Can't reach database` | PostgreSQL not running or wrong URL |
| Railway build fails (OpenSSL) | Dockerfile uses node:20-slim with apt OpenSSL — already fixed |
| Vercel build fails | Check Root Directory is set to `frontend` |

---

## npm Scripts Reference

### Backend
```bash
npm run dev          # nodemon dev server
npm run start        # production server
npm run start:railway # migrate + generate + start (Railway CMD)
npm run db:push      # sync schema to DB
npm run db:migrate   # create + apply named migration
npm run db:seed      # seed all data
npm run db:setup     # db:push + db:seed
npm run db:reset     # wipe + re-seed
npm run db:studio    # Prisma Studio at :5555
npm run build        # prisma generate
```

### Frontend
```bash
npm run dev     # Next.js dev server at :3000
npm run build   # production build
npm run start   # serve production build
npm run lint    # ESLint check
```

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India — civitasatlasco@gmail.com*
