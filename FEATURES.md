# S2R2 Inventory Management System — Feature Reference

**Version:** 2.0
**Built by:** Civitas Atlas Technologies Pvt. Ltd., Pune, India
**Last Updated:** 2026-09-10

---

## 1. Authentication & User Management

### Login
- JWT-based authentication (8-hour token)
- Username + password login
- Auto-logout on inactivity (15 minutes)
- Redirect to login on token expiry

### Roles
| Role | Description |
|------|-------------|
| ADMIN | Full access — manage users, delete records, clear logs, manage IoT devices |
| EDITOR | Add & edit inventory, clients, manufacture operations |
| VIEWER | Read-only access to all modules |

### User Management (ADMIN only)
- Create, edit, delete users
- Assign roles (ADMIN / EDITOR / VIEWER)
- Prevent self-deletion
- Live editable permission matrix (EDITOR/VIEWER access per feature)

---

## 2. Raw Materials

### CRUD
- Create raw material with: name, category, description, quantity, unit, supplier, location, min stock, unit price
- Edit all fields with partial update support
- Delete with cascade — removes from all BOMs automatically
- Unique name constraint — prevents duplicates

### Stock Management
- **Inward** — add stock when receiving from suppliers, creates audit transaction
- **Outward** — remove stock for manual consumption, validates sufficient stock, creates audit transaction
- Low stock alert shown when quantity ≤ min stock
- Out of stock alert when quantity = 0

### Status Derivation (computed, not stored)
- `active` — quantity > min stock
- `low` — 0 < quantity ≤ min stock
- `out` — quantity = 0

### Views
- Grid view — cards with stock bar, price, supplier, location
- Table view — sortable columns, all fields visible

### Timestamps (YYYY-MM-DD HH:MM:SS)
- `Last Updated` — shown in table, grid card, and edit modal
- `Created At` — shown in table and edit modal
- Both fields included in all exports

### Filters
- Search by name, description, supplier
- Filter by category
- Filter by status (In Stock / Low Stock / Out of Stock)

### Export
- **CSV** — all fields including timestamps
- **Excel (.xlsx)** — branded header, all fields including timestamps
- **PDF** — landscape, all columns including Last Updated + Created At

### Import
- Excel/CSV bulk import
- Column mapping: Name, Category, Description, Qty, Unit, Supplier, Location, Min Stock, Price (₹)
- Downloadable template

---

## 3. Finished Products

### CRUD
- Create finished product with: name, qty, unit, category, location, supplier, min stock, price, status (ACTIVE/HOLD)
- Edit with partial update
- Delete with cascade — removes BOM entries automatically
- Unique name constraint

### Stock Management
- **Inward** — restock finished goods directly
- **Outward** — dispatch finished goods, validates stock
- **Manufacture** — produce units using BOM (see Section 5)

### Status & Stock Status
- `status`: ACTIVE / HOLD (manually set)
- `stockStatus`: active / low / out (computed from qty vs minStock)

### Views
- Grid view with stock progress bar and timestamp
- Table view with sortable columns

### Timestamps (YYYY-MM-DD HH:MM:SS)
- `Created At` and `Updated At` shown in table, grid card, and edit modal
- Both included in all exports

### Export
- **CSV**, **Excel**, **PDF** (landscape) — all include timestamps

### Import
- Excel/CSV bulk import with downloadable template

---

## 4. Bill of Materials (BOM)

### Definition
- Map which raw materials (and quantities) are needed to produce 1 unit of a finished product
- Multiple raw materials per product
- Unique constraint: one entry per (product, raw material) pair
- Cascade delete: if raw material or finished product is deleted, BOM entries are removed

### BOM Management Page
- View all BOMs across all products in one screen
- Add, edit, remove BOM entries per product
- Quantity required per unit configurable per entry

### Feasibility Check
- Input: finished product + desired quantity to produce
- Output: per-material breakdown — available vs required vs shortfall
- Shows maximum producible quantity
- Real-time check before committing manufacture

---

## 5. Manufacture

### Produce
- Select finished product + quantity to manufacture
- System validates all BOM materials have sufficient stock
- On confirmation:
  - Deducts raw materials atomically (all-or-nothing transaction)
  - Increments finished product stock
  - Creates MANUFACTURE transaction records for every raw material deducted + the output product
- Returns low-stock alerts for any raw materials that dropped below min stock

### Stock Movements
- **INWARD** — raw material or finished product received
- **OUTWARD** — finished product dispatched
- **MANUFACTURE** — raw materials consumed → finished product produced

### Transaction History
- Paginated list of all stock movements
- Filter by transaction type, item type, search by item name
- Full timestamps on every entry (YYYY-MM-DD HH:MM:SS)
- Shows: type, item, quantity (positive = added, negative = consumed), note, performed by, date/time

---

## 6. Clients

### CRUD
- Create client with: name, company, phone, email, address, GST number, status
- Edit all fields
- Delete
- Unique email constraint — prevents duplicates

### Status
- ACTIVE / INACTIVE

### Views
- Grid view — cards with contact info and timestamp
- Table view — all columns including full timestamp

### Timestamps (YYYY-MM-DD HH:MM:SS)
- `Created At` shown in table, grid card, and edit modal
- Included in all exports

### Export
- **CSV** — all fields including timestamps
- **Excel (.xlsx)** — branded, all fields including timestamps
- **PDF** (landscape) — includes GST No, Created At, Updated At

### Import
- Excel/CSV bulk import
- Skips duplicate emails silently
- Downloadable column template

---

## 7. Dashboard

### Statistics Cards
- Raw Materials: total items, total quantity, total stock value, low/out count
- Finished Products: total products, total quantity, stock value, in stock / low / out
- Clients: total, new this month
- IoT Devices: total, online, offline, maintenance

### Low Stock Alerts
- Combined list of raw materials and finished products below min stock
- Urgency: CRITICAL (qty=0) / HIGH (ratio ≤ 1) / MEDIUM (ratio ≤ 1.5)

### Recent Activity
- Last 9 activity log entries with timestamps

### Stock Movement Chart
- Chart-ready labels + values for visual stock history

### Cost Analysis
- Raw material total value, finished product total value, potential revenue
- Top 5 raw materials and finished products by value

### Recent Transactions
- Last 10 inventory transactions with full timestamps

---

## 8. Civi AI — Decision Intelligence

### Intelligence Report (`GET /api/intelligence`)
Full AI-powered analysis with:

**Reorder Alerts**
- CRITICAL / HIGH / MEDIUM urgency per raw material
- Current qty vs min stock ratio
- Supplier info

**Manufacture Readiness**
- For each finished product with a BOM:
  - Maximum producible quantity
  - Per-material breakdown (available vs required)
  - Action suggestion: MANUFACTURE_NOW / MANUFACTURE_SOON / RESTOCK_MATERIALS / SUFFICIENT

**Replenishment Plan**
- Suggested reorder quantity per item
- Estimated cost per item
- Total replenishment cost

**Velocity Analysis**
- 30-day consumption per raw material
- Daily average consumption
- Days of stock remaining
- Risk level: HIGH (≤7 days) / MEDIUM (≤14) / LOW (≤30) / STABLE

**AI Narrative**
- 6-section executive summary generated by Groq LLM
- Concise, actionable, decision-focused
- Gracefully disabled if GROQ_API_KEY not set

### Civi AI Chat
- Conversational AI assistant with live inventory context injected as system prompt
- Maintains conversation history (last 8 messages)
- Answers questions about stock levels, reorder priorities, manufacture feasibility
- Powered by Groq SDK

### Intelligence PDF Export
- 6-section report: cover page, KPI summary, reorder alerts, manufacture readiness, replenishment plan, velocity
- Full branding, page numbers, timestamp

---

## 9. Activity Log

- Paginated audit trail of every user action (create / update / delete)
- Covers: raw materials, finished products, clients, IoT devices, users, BOM
- Filter by module, action type, username
- Full timestamps (eventTime) on every entry
- Distinct username list for filter dropdowns
- Clear all logs (ADMIN only)

---

## 10. IoT Devices

### Registry
- Register devices with: device ID, name, type, location, status, metadata (JSON)
- Unique device ID constraint
- Metadata supports arbitrary JSON for device-specific config

### Status Tracking
- ONLINE / OFFLINE / MAINTENANCE
- PATCH /ping — sets device to ONLINE + records lastPing timestamp

### Access Control
- View/ping: all authenticated users
- Create/edit/delete: ADMIN only

---

## 11. Reports

### Multi-tab Reports Page
- Raw Materials report
- Finished Products report
- Clients report
- Transaction History

### Date Filtering
- From / To date range filter applies to all reports

### Export Formats
- **CSV** — comma-separated, downloadable
- **Excel (.xlsx)** — branded header row
- **PDF** (server-side, pdfkit) — formatted tables, headers, branding footer

### Timestamp Standard
All reports and exports use: `YYYY-MM-DD HH:MM:SS` format consistently.

---

## 12. Date & Timestamp Standards

All date/timestamp handling follows these rules:

| Rule | Implementation |
|------|----------------|
| Format | `YYYY-MM-DD HH:MM:SS` everywhere |
| Automatic default | If no date entered, system date/time is used automatically |
| Never null | All date fields have `@default(now())` in Prisma schema |
| UI display | Tables show full timestamp. Grid cards show short timestamp |
| Modal display | Edit modal shows read-only Created At / Last Updated timestamps |
| CSV export | Full `YYYY-MM-DD HH:MM:SS` timestamps in all date columns |
| Excel export | Full `YYYY-MM-DD HH:MM:SS` timestamps in all date columns |
| PDF export | Full `YYYY-MM-DD HH:MM:SS` timestamps in column and header |
| Transaction logs | `createdAt` on every InventoryTransaction record |
| Activity logs | `eventTime` on every ActivityLog record |

---

## 13. Security

### Integrity Guard
- On startup: verifies required env vars, OWNER_SIG HMAC, DB connectivity
- On every request: re-checks env vars + OWNER_SIG
- Returns 503 if any check fails

### Rate Limiting
- API routes: 100 requests / 15 min per IP
- Auth routes: 5 requests / 15 min per IP

### Request Validation
- Content-Length > 10MB rejected (413)
- Body scan for suspicious patterns

### CORS
- Only `FRONTEND_URL` origin allowed
- Credentials: true

### JWT
- HS256, 8-hour expiry
- Payload: sub (user ID), username, role

---

## 14. License System

Trial/license system is currently **disabled** — the application runs as fully licensed with no expiry.

To re-enable, set `TRIAL_ENABLED=true` and a valid `TRIAL_LICENSE_KEY` in `backend/.env`.

Available keys (when enabled):
| Key | Plan | Expiry |
|-----|------|--------|
| `Civitas@admin0919` | 1-month | 2026-09-19 |
| `Civitas@admin0219` | 6-month | 2027-02-19 |
| `Civitas@admin0819` | 1-year | 2027-08-19 |

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India — civitasatlasco@gmail.com*
