# S2R2 Inventory — Database Guide

**PostgreSQL 17 (local dev) / Neon Serverless PostgreSQL (production)**
Managed via Prisma ORM 5.

---

## Option A — Local PostgreSQL 17

### Step 1 — Install PostgreSQL 17

Download from [postgresql.org/download](https://www.postgresql.org/download/)
- Note the `postgres` superuser password during install
- Default port: `5432`
- pgAdmin 4 is included for visual management

Verify:
```powershell
psql --version   # psql (PostgreSQL) 17.x
```

---

### Step 2 — Create Database and User

**Option 1 — SQL script (recommended)**
```powershell
psql -U postgres -h 127.0.0.1 -f backend/setup-local-db.sql
```

**Option 2 — PowerShell script (Windows)**
```powershell
cd backend
.\create-local-db.ps1
```

**Option 3 — Manual SQL**
```sql
CREATE USER s2r2_user WITH PASSWORD 's2r2pass';
CREATE DATABASE s2r2_inventory OWNER s2r2_user;
GRANT ALL PRIVILEGES ON DATABASE s2r2_inventory TO s2r2_user;
\c s2r2_inventory
GRANT ALL ON SCHEMA public TO s2r2_user;
```

**Option 4 — pgAdmin 4**
1. Login Roles → Create → name: `s2r2_user`, password: `s2r2pass`, Can login: ✓
2. Databases → Create → name: `s2r2_inventory`, owner: `s2r2_user`

---

### Step 3 — Configure .env

```env
DATABASE_URL="postgresql://s2r2_user:s2r2pass@localhost:5432/s2r2_inventory"
```

No `DIRECT_URL` needed for local setup.

---

### Step 4 — Create Tables + Seed Data

```bash
cd backend
npm run db:setup    # = db:push + db:seed
```

---

### Local Connection Details

| Field    | Value            |
|----------|------------------|
| Host     | localhost        |
| Port     | 5432             |
| Database | s2r2_inventory   |
| Username | s2r2_user        |
| Password | s2r2pass         |

---

## Option B — Neon (Production / Cloud)

### Step 1 — Create Neon project

1. Go to [console.neon.tech](https://console.neon.tech)
2. New Project → name: `s2r2-inventory`
3. Region: `ap-southeast-1` (Singapore) — closest to Pune

### Step 2 — Get connection strings

In Neon Console → Connection Details, get both:

| Type | Use for | URL pattern |
|------|---------|-------------|
| **Pooled** (toggle ON) | `DATABASE_URL` — app queries | `ep-xxx-pooler.c-X...neon.tech` |
| **Direct** (toggle OFF) | `DIRECT_URL` — migrations | `ep-xxx.c-X...neon.tech` |

### Step 3 — Configure .env (production)

```env
DATABASE_URL="postgresql://neondb_owner:PASSWORD@ep-xxx-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://neondb_owner:PASSWORD@ep-xxx.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

### Step 4 — Run migrations + seed

```bash
cd backend
npx prisma migrate deploy    # applies migration history to Neon
node prisma/seed.js          # seeds all data
```

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | Authentication — username, bcrypt password, role |
| `raw_materials` | Input inventory — stock, pricing, supplier |
| `finished_products` | Output inventory — manufactured goods |
| `bill_of_materials` | Component requirements per finished product |
| `inventory_transactions` | Full audit log of all stock movements |
| `clients` | Customer records |
| `iot_devices` | IoT device registry with ping status |
| `activity_logs` | User action audit trail |

### Enums

| Enum | Values |
|------|--------|
| `Role` | ADMIN, EDITOR, VIEWER, USER |
| `FinishedProductStatus` | ACTIVE, HOLD |
| `TransactionType` | INWARD, OUTWARD, MANUFACTURE |
| `ItemType` | RAW_MATERIAL, FINISHED_PRODUCT |
| `ClientStatus` | ACTIVE, INACTIVE |
| `IoTDeviceStatus` | ONLINE, OFFLINE, MAINTENANCE |

### Key Constraints

| Constraint | Detail |
|------------|--------|
| `users.username` | UNIQUE |
| `raw_materials.name` | UNIQUE |
| `finished_products.name` | UNIQUE |
| `clients.email` | UNIQUE |
| `iot_devices.device_id` | UNIQUE |
| `bill_of_materials (fp_id, rm_id)` | UNIQUE pair |
| BOM → finished_products | CASCADE delete |
| BOM → raw_materials | CASCADE delete |

### Entity Relationships

```
users ─────────────────── (username denormalized in logs/transactions)

raw_materials ──────── bill_of_materials ──────── finished_products
      │                                                   │
      └──── inventory_transactions ─────────────────────────┘

clients ──────────────────── (standalone)
iot_devices ─────────────── (standalone)
activity_logs ───────────── (standalone)
```

---

## Prisma Commands

```bash
# From backend/ folder

npm run db:push        # sync schema → DB (no migration history)
npm run db:migrate     # create named migration + apply
npm run db:seed        # seed all data (idempotent — safe to re-run)
npm run db:setup       # db:push + db:seed (first-time setup)
npm run db:reset       # wipe all tables + re-seed
npm run db:studio      # Prisma Studio GUI at http://localhost:5555
npm run build          # regenerate Prisma client after schema change
```

---

## Seed Data

Running `npm run db:seed` creates (all upserts — safe to re-run):

| Data | Count |
|------|-------|
| Users | 8 (3 ADMIN + 5 EDITOR) |
| Raw Materials | 24 (6 core + 18 BOM-specific) |
| Finished Products | 5 |
| BOM entries | 26 across 5 products |
| Clients | 9 real companies |

---

## Backup and Restore (Local)

```powershell
# Backup
pg_dump -U s2r2_user -h 127.0.0.1 -d s2r2_inventory -F c -f s2r2_backup.dump

# Restore
pg_restore -U s2r2_user -h 127.0.0.1 -d s2r2_inventory -F c s2r2_backup.dump
```

---

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| `P1001: Can't reach database` | PostgreSQL not running | `Start-Service postgresql-x64-17` |
| `P1003: Database does not exist` | DB not created | Run setup-local-db.sql |
| `password authentication failed` | Wrong credentials | Verify user in pgAdmin |
| `permission denied for schema public` | Missing grant | `GRANT ALL ON SCHEMA public TO s2r2_user;` |
| `P2002: Unique constraint failed` | Duplicate seed data | Run `npm run db:reset` |
| `P3005: DB schema not empty` | DB has tables but no migration history | `npx prisma migrate resolve --applied 20260823000000_init` |
| `Prisma Client out of sync` | Schema changed | `npm run build` |

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India*
