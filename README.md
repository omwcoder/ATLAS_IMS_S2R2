# S2R2 Inventory Management System

Built by **Civitas Atlas Technologies Pvt. Ltd., Pune, India**
Contact: civitasatlasco@gmail.com

---

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Frontend | Next.js 14, Tailwind CSS          |
| Backend  | Node.js, Express.js               |
| Database | PostgreSQL (local)                |
| ORM      | Prisma 5                          |
| AI       | Groq SDK (Civi AI — optional)     |

---

## Project Structure

```
s2r2-inventory/
├── backend/          Express API + Prisma
│   ├── prisma/       Schema + seed
│   ├── src/
│   │   ├── middleware/
│   │   └── routes/
│   └── server.js
├── frontend/         Next.js app
│   ├── app/          Pages (App Router)
│   ├── components/
│   └── lib/          API client + hooks
└── README.md
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ running locally

---

## Quick Start

### 1. Create the local database

Run this once in pgAdmin or psql as the `postgres` superuser:

```sql
-- setup-local-db.sql (already in backend/)
CREATE USER s2r2_user WITH PASSWORD 's2r2pass';
CREATE DATABASE s2r2_inventory OWNER s2r2_user;
GRANT ALL PRIVILEGES ON DATABASE s2r2_inventory TO s2r2_user;
\c s2r2_inventory
GRANT ALL ON SCHEMA public TO s2r2_user;
```

Or on Windows run the PowerShell script:
```powershell
cd backend
.\create-local-db.ps1
```

---

### 2. Backend setup

```bash
cd backend
cp .env.example .env        # copy env file
npm install                 # install dependencies
npm run db:push             # create tables from schema
npm run db:seed             # seed users, products, clients, BOM
npm run dev                 # start dev server on :4000
```

Backend runs at: `http://localhost:4000`
Health check: `http://localhost:4000/health`

---

### 3. Frontend setup

```bash
cd frontend
cp .env.local.example .env.local   # already set to localhost:4000
npm install
npm run dev                        # start Next.js on :3000
```

Frontend runs at: `http://localhost:3000`

---

## Login Credentials

| Username | Password       | Role   |
|----------|----------------|--------|
| sandeep  | Sandeep@2025   | ADMIN  |
| rohan    | Rohan@2025     | ADMIN  |
| akshay   | Akshay@2025    | ADMIN  |
| emp1     | Emp1@2025      | EDITOR |
| emp2     | Emp2@2025      | EDITOR |
| emp3     | Emp3@2025      | EDITOR |
| emp4     | Emp4@2025      | EDITOR |
| emp5     | Emp5@2025      | EDITOR |

---

## Features

- Raw Materials — CRUD, inward/outward stock, Excel import, PDF export
- Finished Products — CRUD, manufacture from BOM, stock tracking
- Bill of Materials — define components per product, feasibility check
- Clients — CRUD, Excel import, export
- IoT Devices — device registry, ping, status tracking
- Dashboard — live stats, stock value, cost analysis, charts
- Activity Log — full audit trail per user
- Reports — multi-tab, date filter, CSV/Excel/PDF
- Civi AI — inventory intelligence, reorder alerts, manufacture readiness, chat
- User Management — ADMIN/EDITOR/VIEWER roles, permission matrix
- Trial / License guard — key-based expiry system

---

## Backend Scripts

```bash
npm run dev          # nodemon dev server
npm run start        # production server
npm run db:push      # sync schema to DB (no migration history)
npm run db:migrate   # create migration and apply
npm run db:seed      # seed all data
npm run db:setup     # db:push + db:seed (first-time setup)
npm run db:reset     # wipe and recreate all tables + seed
npm run db:studio    # Prisma Studio GUI at :5555
npm run test         # run route tests
```

---

## Environment Variables

See `backend/.env.example` for all variables and descriptions.

Key variables:

| Variable          | Description                        |
|-------------------|------------------------------------|
| `DATABASE_URL`    | PostgreSQL connection string       |
| `JWT_SECRET`      | Token signing secret               |
| `FRONTEND_URL`    | CORS allowed origin                |
| `OWNER_SIG`       | Ownership HMAC (do not change)     |
| `GROQ_API_KEY`    | Groq AI key (optional)             |
| `TRIAL_LICENSE_KEY` | License key for trial system     |

---

## Ownership

This software is the property of **Civitas Atlas Technologies Pvt. Ltd.**
Unauthorised modification or redistribution is prohibited.
