# S2R2 Inventory — Database Setup Guide

**PostgreSQL 17 + Prisma ORM 5**
Built by Civitas Atlas Technologies Pvt. Ltd., Pune, India

---

## Overview

The system uses a local PostgreSQL 17 database managed through Prisma ORM.

```
PostgreSQL 17 (local)
    └── Database: s2r2_inventory
        └── User: s2r2_user / pass: s2r2pass
            └── 8 tables managed by Prisma
```

---

## Prerequisites

- PostgreSQL 17 installed and running locally
- Default port: `5432`
- pgAdmin 4 (optional — for visual management)

### Check if PostgreSQL is running (Windows)

```powershell
Get-Service postgresql*
# Should show: Running
```

If stopped:
```powershell
Start-Service postgresql-x64-17
```

---

## Step 1 — Create Database and User

### Option A — Using psql (command line)

Open **SQL Shell (psql)** or run:

```powershell
psql -U postgres -h 127.0.0.1 -f backend/setup-local-db.sql
```

### Option B — Using PowerShell script

```powershell
cd backend
.\create-local-db.ps1
```

### Option C — Manual SQL (run as postgres superuser)

```sql
-- Create dedicated user
CREATE USER s2r2_user WITH PASSWORD 's2r2pass';

-- Create database owned by that user
CREATE DATABASE s2r2_inventory OWNER s2r2_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE s2r2_inventory TO s2r2_user;

-- Connect to the new database and grant schema access
\c s2r2_inventory
GRANT ALL ON SCHEMA public TO s2r2_user;
```

### Option D — pgAdmin 4

1. Open pgAdmin → Login Roles → Create → Login/Group Role
   - Name: `s2r2_user`
   - Password: `s2r2pass`
   - Privileges: Can login ✓
2. Databases → Create → Database
   - Name: `s2r2_inventory`
   - Owner: `s2r2_user`

---

## Step 2 — Configure Connection String

In `backend/.env`:

```env
DATABASE_URL="postgresql://s2r2_user:s2r2pass@localhost:5432/s2r2_inventory"
```

Format breakdown:
```
postgresql://  USER  :  PASSWORD  @  HOST  :  PORT  /  DATABASE
              s2r2_user  s2r2pass    localhost  5432    s2r2_inventory
```

---

## Step 3 — Create Tables (Prisma Schema Push)

From the `backend/` folder:

```powershell
cd backend
npm run db:push
```

This reads `prisma/schema.prisma` and creates all 8 tables in `s2r2_inventory`.

Expected output:
```
Your database is now in sync with your Prisma schema.
```

---

## Step 4 — Seed Initial Data

```powershell
npm run db:seed
```

This creates:

| Data | Count |
|------|-------|
| Users | 8 (3 ADMIN + 5 EDITOR) |
| Raw Materials | 24 (6 core + 18 BOM-specific) |
| Finished Products | 5 |
| Bill of Materials | 26 entries across 5 products |
| Clients | 9 |

Or run both together:

```powershell
npm run db:setup   # = db:push + db:seed
```

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | Authentication — username, bcrypt password, role |
| `raw_materials` | Input inventory — stock levels, pricing, supplier |
| `finished_products` | Output inventory — manufactured goods |
| `bill_of_materials` | Component requirements per finished product |
| `inventory_transactions` | Full audit log of all stock movements |
| `clients` | Customer / client records |
| `iot_devices` | IoT device registry with ping status |
| `activity_logs` | User action audit trail |

### Entity Relationship

```
users ────────────────────────── (no FK — username denormalized in logs)
                                          │
raw_materials ──────────────── bill_of_materials ──────── finished_products
      │                               │                          │
      └── inventory_transactions ─────┘                         │
                                                                 │
clients ─────────────────────────────────────────────────────────

iot_devices ──────────────────── (standalone)
activity_logs ────────────────── (standalone — username denormalized)
```

### Key Constraints

| Constraint | Detail |
|------------|--------|
| `users.username` | UNIQUE |
| `raw_materials.name` | UNIQUE — supports upsert-by-name in seed |
| `finished_products.name` | UNIQUE — supports upsert-by-name in seed |
| `clients.email` | UNIQUE |
| `iot_devices.device_id` | UNIQUE |
| `bill_of_materials (fp_id, rm_id)` | UNIQUE pair — no duplicate BOM entries |
| BOM → finished_products | CASCADE delete |
| BOM → raw_materials | CASCADE delete |

---

## Prisma Schema File

Location: `backend/prisma/schema.prisma`

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

No `directUrl` needed for local setup.

For full model definitions see `backend/prisma/README.md`.

---

## Useful Commands

```powershell
# From backend/ folder

npm run db:push       # Sync schema to DB (no migration history)
npm run db:migrate    # Create named migration + apply
npm run db:seed       # Run seed.js
npm run db:setup      # db:push + db:seed (first-time)
npm run db:reset      # Wipe all tables + re-seed
npm run db:studio     # Open Prisma Studio at http://localhost:5555
```

### Direct psql access

```powershell
psql -U s2r2_user -h 127.0.0.1 -d s2r2_inventory
```

### Check table row counts

```sql
SELECT
  tablename,
  (xpath('/row/c/text()',
    query_to_xml('SELECT COUNT(*) AS c FROM ' || tablename, false, false, ''))
  )[1]::text::int AS row_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

---

## Prisma Studio (Visual DB Browser)

```powershell
cd backend
npm run db:studio
# Opens at http://localhost:5555
```

Browse, filter, edit all tables visually. Useful for checking seed data and debugging.

---

## Backup and Restore

### Backup

```powershell
pg_dump -U s2r2_user -h 127.0.0.1 -d s2r2_inventory -F c -f s2r2_backup.dump
```

### Restore

```powershell
pg_restore -U s2r2_user -h 127.0.0.1 -d s2r2_inventory -F c s2r2_backup.dump
```

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `P1001: Can't reach database` | PostgreSQL not running | `Start-Service postgresql-x64-17` |
| `P1003: Database does not exist` | DB not created | Run Step 1 above |
| `password authentication failed` | Wrong credentials | Verify `s2r2_user` and `s2r2pass` in pgAdmin |
| `permission denied for schema public` | Schema permissions missing | Run `GRANT ALL ON SCHEMA public TO s2r2_user;` in `s2r2_inventory` DB |
| `P2002: Unique constraint failed` | Duplicate data in seed | Run `npm run db:reset` to wipe and re-seed |
| `P3005: DB schema is not empty` | DB has tables but no migration history | Run `npx prisma migrate resolve --applied <migration_name>` |
| Tables missing after schema change | Schema not pushed | Run `npm run db:push` |
| Prisma Client out of sync | Schema changed but client not regenerated | Run `npm run build` or `npx prisma generate` |

---

## Default Credentials

| Field | Value |
|-------|-------|
| Database | `s2r2_inventory` |
| Username | `s2r2_user` |
| Password | `s2r2pass` |
| Host | `localhost` |
| Port | `5432` |
| Connection string | `postgresql://s2r2_user:s2r2pass@localhost:5432/s2r2_inventory` |

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India*
*civitasatlasco@gmail.com*
