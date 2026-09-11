# S2R2 Inventory Management System

**Built by Civitas Atlas Technologies Pvt. Ltd., Pune, India**
Contact: civitasatlasco@gmail.com

A full-stack IoT-integrated inventory management system for S2R2 Technologies —
tracking raw materials, finished products, bill of materials, clients, and IoT devices
with AI-powered decision intelligence (Civi AI).

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | Next.js 14, Tailwind CSS          |
| Backend  | Node.js 20, Express.js            |
| Database | PostgreSQL 17 (local) / Neon (production) |
| ORM      | Prisma 5                          |
| AI       | Groq SDK — Civi AI                |
| Hosting  | Railway (backend) + Vercel (frontend) |

---

## Project Structure

```
s2r2-inventory/
├── README.md              This file
├── DATABASE.md            Database setup guide (local + Neon)
├── DEPLOYMENT.md          Full deployment guide (local + Railway + Vercel)
│
├── backend/               Express API server
│   ├── server.js
│   ├── prisma/            Schema + migrations + seed
│   ├── src/
│   │   ├── middleware/    auth, integrity, security, trial
│   │   └── routes/        all API route handlers
│   ├── .env.example       Environment variable template
│   └── README.md          Backend API reference
│
└── frontend/              Next.js 14 app
    ├── app/               Pages (App Router)
    ├── components/        UI components
    ├── lib/               API client + hooks
    ├── types/             TypeScript types
    ├── .env.local.example Environment variable template
    └── README.md          Frontend reference
```

---

## Quick Start — Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL 17 running locally

### 1. Database
```bash
# Run as postgres superuser
psql -U postgres -h 127.0.0.1 -f backend/setup-local-db.sql
```
Creates user `s2r2_user` / password `s2r2pass` and database `s2r2_inventory`.

### 2. Backend
```bash
cd backend
cp .env.example .env       # already configured for local
npm install
npm run db:setup           # creates tables + seeds all data
npm run dev                # starts on http://localhost:4000
```

### 3. Frontend
```bash
cd frontend
cp .env.local.example .env.local   # already set to localhost:4000
npm install
npm run dev                        # starts on http://localhost:3000
```

Open **http://localhost:3000** and login.

---

## Login Credentials

| Username | Password     | Role   |
|----------|--------------|--------|
| sandeep  | Sandeep@2025 | ADMIN  |
| rohan    | Rohan@2025   | ADMIN  |
| akshay   | Akshay@2025  | ADMIN  |
| emp1     | Emp1@2025    | EDITOR |
| emp2     | Emp2@2025    | EDITOR |
| emp3     | Emp3@2025    | EDITOR |
| emp4     | Emp4@2025    | EDITOR |
| emp5     | Emp5@2025    | EDITOR |

---

## Features

- **Raw Materials** — CRUD, inward/outward stock, Excel import, PDF export
- **Finished Products** — CRUD, manufacture from BOM, stock tracking
- **Bill of Materials** — define components per product, feasibility check
- **Manufacture** — atomic BOM deduction, produce runs, transaction history
- **Clients** — CRUD, Excel import, export
- **IoT Devices** — device registry, ping status tracking
- **Dashboard** — live stats, stock value, cost analysis, charts
- **Activity Log** — full audit trail per user action with timestamps
- **Reports** — multi-tab, date filter, CSV / Excel / PDF
- **Civi AI** — inventory intelligence, reorder alerts, manufacture readiness, AI chat
- **User Management** — ADMIN / EDITOR / VIEWER roles, permission matrix
- **Timestamps** — all exports and tables show `YYYY-MM-DD HH:MM:SS` consistently

See **FEATURES.md** for the complete feature reference.

---

## Ports

| Service          | Port | URL                        |
|------------------|------|----------------------------|
| Frontend         | 3000 | http://localhost:3000       |
| Backend API      | 4000 | http://localhost:4000       |
| PostgreSQL       | 5432 | localhost:5432              |
| Prisma Studio    | 5555 | http://localhost:5555       |

---

## Documentation

| File | Contents |
|------|----------|
| `DATABASE.md` | PostgreSQL 17 setup, Neon setup, schema, commands |
| `DEPLOYMENT.md` | Local dev + Railway + Vercel production deployment |
| `backend/README.md` | All API endpoints, scripts, environment variables |
| `backend/prisma/README.md` | Full Prisma schema reference — all 8 models |
| `frontend/README.md` | Pages, components, auth flow, permissions |

---

## Production Deployment

See **DEPLOYMENT.md** for the complete guide.

Summary:
- **Database** → Neon (serverless PostgreSQL)
- **Backend** → Railway (Docker, Node.js 20)
- **Frontend** → Vercel (Next.js)

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India — civitasatlasco@gmail.com*
*Unauthorised modification or redistribution is prohibited.*
