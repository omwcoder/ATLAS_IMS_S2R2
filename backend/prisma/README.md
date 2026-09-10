# S2R2 Inventory — Prisma Schema Reference

**Prisma 5.22 + PostgreSQL**
Schema file: `backend/prisma/schema.prisma`

---

## Datasource

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled URL (local or Neon pooler)
  directUrl = env("DIRECT_URL")     // direct URL for migrations (Neon only — omit locally)
}
```

---

## Models

### User

Table: `users`

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| username | String | UNIQUE |
| password | String | bcrypt hash (cost 10) |
| role | Role enum | default: USER |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

---

### RawMaterial

Table: `raw_materials`

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| name | String | UNIQUE |
| category | String | e.g. Electronics, Sensors |
| description | String? | optional |
| quantity | Float | default: 0 |
| unit | String | default: pcs |
| supplier | String? | optional |
| location | String? | optional |
| minStock | Float | default: 0, mapped: min_stock |
| price | Float | default: 0, unit price |
| lastUpdated | DateTime | updated on stock change |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

Relations: `bomEntries BillOfMaterials[]`

Derived field (computed in routes, not in DB):
- `status` — `"active"` / `"low"` / `"out"` based on quantity vs minStock

---

### FinishedProduct

Table: `finished_products`

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| name | String | UNIQUE |
| qty | Float | default: 0 |
| unit | String | default: Box |
| category | String | default: Finished Products |
| location | String? | optional |
| supplier | String? | optional |
| minStock | Float | default: 0 |
| price | Float | default: 0 |
| status | FinishedProductStatus | default: ACTIVE |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

Relations: `bomEntries BillOfMaterials[]`

---

### BillOfMaterials

Table: `bill_of_materials`

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| finishedProductId | Int | FK → finished_products (CASCADE) |
| rawMaterialId | Int | FK → raw_materials (CASCADE) |
| quantityRequired | Float | default: 1 — units of RM needed per 1 FP |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

Unique constraint: `(finishedProductId, rawMaterialId)` — no duplicate entries per product.

---

### InventoryTransaction

Table: `inventory_transactions`

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| transactionType | TransactionType | INWARD / OUTWARD / MANUFACTURE |
| itemType | ItemType | RAW_MATERIAL / FINISHED_PRODUCT |
| itemId | Int | denormalized — ID of the item |
| itemName | String | denormalized — name for display |
| quantity | Float | positive = added, negative = deducted |
| note | String? | optional description |
| performedBy | String | username — denormalized |
| createdAt | DateTime | auto |

No FK relations — fully denormalized for immutable audit history.

---

### Client

Table: `clients`

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| clientName | String | individual/contact name |
| companyName | String? | company name |
| phone | String? | |
| email | String? | UNIQUE |
| address | String? | |
| gstNo | String? | GST number |
| status | ClientStatus | default: ACTIVE |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

---

### IoTDevice

Table: `iot_devices`

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| deviceId | String | UNIQUE — hardware ID |
| name | String | display name |
| type | String? | e.g. Sensor, Gateway |
| location | String? | physical location |
| status | IoTDeviceStatus | default: ONLINE |
| lastPing | DateTime? | set on PATCH /ping |
| metadata | Json? | arbitrary device data |
| createdAt | DateTime | auto |
| updatedAt | DateTime | auto |

---

### ActivityLog

Table: `activity_logs`

| Field | Type | Notes |
|-------|------|-------|
| id | Int | PK, autoincrement |
| module | String | e.g. raw_material, finished_product |
| label | String | item name or description |
| action | String | created / updated / deleted |
| username | String | default: system |
| eventTime | DateTime | auto |

---

## Enums

```prisma
enum Role                 { ADMIN EDITOR VIEWER USER }
enum FinishedProductStatus { ACTIVE HOLD }
enum TransactionType      { INWARD OUTWARD MANUFACTURE }
enum ItemType             { RAW_MATERIAL FINISHED_PRODUCT }
enum ClientStatus         { ACTIVE INACTIVE }
enum IoTDeviceStatus      { ONLINE OFFLINE MAINTENANCE }
```

---

## Prisma Commands

```bash
# From backend/ folder

npx prisma generate              # regenerate Prisma client after schema change
npx prisma db push               # sync schema to DB (no migration history)
npx prisma migrate dev --name X  # create + apply named migration
npx prisma migrate deploy        # apply pending migrations (production)
npx prisma migrate reset --force # wipe all tables + re-seed
npx prisma studio                # GUI browser at http://localhost:5555
npx prisma validate              # validate schema.prisma
```

---

## Seed Data

File: `backend/prisma/seed.js`
Run: `npm run db:seed`

All operations use `upsert` — **safe to re-run at any time**.
Live stock quantities are never overwritten on re-seed.

### What gets seeded

**8 Users**
```
sandeep  / Sandeep@2025  / ADMIN
rohan    / Rohan@2025    / ADMIN
akshay   / Akshay@2025   / ADMIN
emp1     / Emp1@2025     / EDITOR
emp2     / Emp2@2025     / EDITOR
emp3     / Emp3@2025     / EDITOR
emp4     / Emp4@2025     / EDITOR
emp5     / Emp5@2025     / EDITOR
```

**24 Raw Materials** — 6 core + 18 BOM-specific (electronics, mechanical, packaging, wireless, power)

**5 Finished Products**
```
Iotzee              — IoT tracking product
Display             — 7" TFT display unit
Display Stand       — mounting stand
Hold-on Hold Kit    — pipe clamping kit
IoT Tracking Device — basic IoT device
```

**5 Bill of Materials**
```
Iotzee           — 7 components
Display          — 7 components
Display Stand    — 4 components
Hold-on Hold Kit — 5 components
IoT Tracking     — 3 components
```

**9 Clients** — Tata Motors, KBL, Eagle Burgmann, Sansera Engineering, and others.

---

## Migration History

Location: `backend/prisma/migrations/`

| Migration | Description |
|-----------|-------------|
| `20260823000000_init` | Initial schema — all 8 tables, all enums, all constraints |

---

## Adding a New Model (Checklist)

1. Add model to `schema.prisma`
2. Run `npm run db:migrate` (local) or `npx prisma db push` (quick)
3. Run `npm run build` to regenerate Prisma client
4. Create route file in `src/routes/`
5. Mount route in `server.js`
6. Add seed data to `prisma/seed.js` if needed

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India*
