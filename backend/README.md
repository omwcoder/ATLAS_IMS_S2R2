# S2R2 Inventory — Backend API

Express.js + Prisma + PostgreSQL
Built by **Civitas Atlas Technologies Pvt. Ltd., Pune, India**

---

## Setup

### 1. Create local database

Run once as postgres superuser:

```bash
# Using psql
psql -U postgres -h 127.0.0.1 -f setup-local-db.sql

# Or on Windows PowerShell
.\create-local-db.ps1
```

This creates:
- User: `s2r2_user` / password: `s2r2pass`
- Database: `s2r2_inventory`

---

### 2. Configure environment

```bash
cp .env.example .env
```

The default `.env` works out of the box for local PostgreSQL.
Only change `JWT_SECRET` and `GROQ_API_KEY` if needed.

---

### 3. Install and run

```bash
npm install
npm run db:setup    # creates tables + seeds all data
npm run dev         # starts server on :4000
```

---

## Scripts

| Script            | What it does                              |
|-------------------|-------------------------------------------|
| `npm run dev`     | Dev server with nodemon (auto-restart)    |
| `npm run start`   | Production server                         |
| `npm run db:push` | Sync Prisma schema → DB (no migrations)   |
| `npm run db:migrate` | Create + apply a named migration       |
| `npm run db:seed` | Seed users, materials, products, clients  |
| `npm run db:setup`| db:push + db:seed (first-time setup)      |
| `npm run db:reset`| Wipe all tables and re-seed               |
| `npm run db:studio` | Open Prisma Studio GUI on :5555         |
| `npm run build`   | Generate Prisma client                    |
| `npm run test`    | Run API route tests                       |

---

## API Routes

| Method | Path                              | Description                  |
|--------|-----------------------------------|------------------------------|
| POST   | /api/auth/login                   | Login, returns JWT           |
| GET    | /api/raw-materials                | List raw materials            |
| POST   | /api/raw-materials                | Create raw material           |
| PUT    | /api/raw-materials/:id            | Update raw material           |
| DELETE | /api/raw-materials/:id            | Delete raw material           |
| POST   | /api/raw-materials/:id/inward     | Add stock                    |
| POST   | /api/raw-materials/:id/outward    | Remove stock                 |
| GET    | /api/raw-materials/export/pdf     | Export PDF                   |
| POST   | /api/raw-materials/import         | Bulk import from Excel rows  |
| GET    | /api/finished-products            | List finished products        |
| POST   | /api/finished-products            | Create finished product       |
| PUT    | /api/finished-products/:id        | Update finished product       |
| DELETE | /api/finished-products/:id        | Delete finished product       |
| GET    | /api/manufacture/bom/:id          | Get BOM for product           |
| POST   | /api/manufacture/bom/:id          | Set BOM entries               |
| GET    | /api/manufacture/bom/all          | All BOMs                      |
| GET    | /api/manufacture/feasibility/:id  | Check if manufacture possible |
| POST   | /api/manufacture/inward           | Stock inward                  |
| POST   | /api/manufacture/outward          | Stock outward                 |
| POST   | /api/manufacture/produce          | Manufacture (deduct BOM)      |
| GET    | /api/manufacture/transactions     | Transaction history           |
| GET    | /api/clients                      | List clients                  |
| POST   | /api/clients                      | Create client                 |
| PUT    | /api/clients/:id                  | Update client                 |
| DELETE | /api/clients/:id                  | Delete client                 |
| GET    | /api/dashboard/stats              | Full dashboard data           |
| GET    | /api/activity                     | Paginated activity log        |
| DELETE | /api/activity                     | Clear activity log (ADMIN)    |
| GET    | /api/iot-devices                  | List IoT devices              |
| POST   | /api/iot-devices                  | Add device (ADMIN)            |
| PATCH  | /api/iot-devices/:id/ping         | Ping device                   |
| GET    | /api/users                        | List users (ADMIN)            |
| POST   | /api/users                        | Create user (ADMIN)           |
| PUT    | /api/users/:id                    | Update user (ADMIN)           |
| DELETE | /api/users/:id                    | Delete user (ADMIN)           |
| GET    | /api/intelligence                 | Full AI intelligence report   |
| POST   | /api/intelligence/chat            | Chat with Civi AI             |
| GET    | /api/intelligence/export/pdf      | Export intelligence PDF       |
| POST   | /api/trial/activate               | Activate license key          |
| GET    | /health                           | Health + trial status         |

---

## Environment Variables

| Variable           | Required | Description                            |
|--------------------|----------|----------------------------------------|
| `DATABASE_URL`     | Yes      | PostgreSQL connection string           |
| `JWT_SECRET`       | Yes      | JWT signing secret                     |
| `FRONTEND_URL`     | Yes      | Allowed CORS origin                    |
| `OWNER_SIG`        | Yes      | Ownership HMAC — do not change         |
| `PORT`             | No       | Server port (default: 4000)            |
| `NODE_ENV`         | No       | development / production               |
| `GROQ_API_KEY`     | No       | Groq AI key for Civi AI narrative      |
| `TRIAL_LICENSE_KEY`| No       | License key (or set TRIAL_ENABLED=false)|

---

## Database Schema

8 tables:

```
users                  — authentication, roles
raw_materials          — input inventory
finished_products      — output inventory
bill_of_materials      — component requirements per product
inventory_transactions — audit log of all stock movements
clients                — customer records
iot_devices            — IoT device registry
activity_logs          — user action audit trail
```

---

## Seed Data

Running `npm run db:seed` creates:

- 8 users (3 ADMIN + 5 EDITOR)
- 24 raw materials (6 core + 18 BOM-specific)
- 5 finished products (Iotzee, Display, Display Stand, Hold-on Hold Kit, IoT Tracking Device)
- 5 complete BOMs
- 9 real clients

Safe to re-run — all upserts, live stock quantities never overwritten.

---

## Ownership

This software is the property of **Civitas Atlas Technologies Pvt. Ltd.**
civitasatlasco@gmail.com
Unauthorised modification or redistribution is prohibited.
