# S2R2 Inventory — Backend API

**Express.js + Prisma 5 + PostgreSQL**
Built by Civitas Atlas Technologies Pvt. Ltd., Pune, India

---

## Setup

```bash
cd backend
cp .env.example .env
npm install
npm run db:setup    # creates tables + seeds data
npm run dev         # http://localhost:4000
```

Health check: `GET http://localhost:4000/health`

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server with nodemon (auto-restart) |
| `npm run start` | Production server |
| `npm run start:railway` | migrate deploy + generate + start (used by Railway) |
| `npm run build` | Generate Prisma client |
| `npm run db:push` | Sync Prisma schema → DB |
| `npm run db:migrate` | Create + apply named migration |
| `npm run db:seed` | Seed users, materials, products, clients, BOM |
| `npm run db:setup` | db:push + db:seed (first-time) |
| `npm run db:reset` | Wipe all tables + re-seed |
| `npm run db:studio` | Prisma Studio at :5555 |
| `npm run test` | DB connection test |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `DIRECT_URL` | Production only | Neon direct URL for migrations |
| `JWT_SECRET` | ✅ | Token signing secret |
| `FRONTEND_URL` | ✅ | CORS allowed origin |
| `OWNER_SIG` | ✅ | Ownership HMAC — do not change |
| `PORT` | No | Server port (default: 4000) |
| `NODE_ENV` | No | development / production |
| `GROQ_API_KEY` | No | Groq key for Civi AI narrative |
| `TRIAL_LICENSE_KEY` | No | License key (or TRIAL_ENABLED=false) |

---

## API Endpoints

All routes require `Authorization: Bearer <token>` except login.

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → returns JWT |

### Raw Materials
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/raw-materials` | List (filter: search, category, status) |
| POST | `/api/raw-materials` | Create |
| GET | `/api/raw-materials/:id` | Get one |
| PUT | `/api/raw-materials/:id` | Update |
| DELETE | `/api/raw-materials/:id` | Delete |
| POST | `/api/raw-materials/:id/inward` | Add stock |
| POST | `/api/raw-materials/:id/outward` | Remove stock |
| POST | `/api/raw-materials/import` | Bulk import from Excel rows |
| GET | `/api/raw-materials/export/pdf` | Export PDF |

### Finished Products
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/finished-products` | List (filter: search, status, stockStatus) |
| POST | `/api/finished-products` | Create |
| GET | `/api/finished-products/:id` | Get one |
| PUT | `/api/finished-products/:id` | Update |
| DELETE | `/api/finished-products/:id` | Delete |
| POST | `/api/finished-products/import` | Bulk import |
| GET | `/api/finished-products/export/pdf` | Export PDF |

### Manufacture & BOM
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/manufacture/bom/all` | All BOMs for all products |
| GET | `/api/manufacture/bom/:id` | BOM for one product |
| POST | `/api/manufacture/bom/:id` | Set/replace BOM entries |
| GET | `/api/manufacture/feasibility/:id?qty=N` | Check if manufacture possible |
| POST | `/api/manufacture/inward` | Stock inward (RM or FP) |
| POST | `/api/manufacture/outward` | Stock outward (FP) |
| POST | `/api/manufacture/produce` | Manufacture — deducts BOM from RM, adds to FP |
| GET | `/api/manufacture/transactions` | Transaction history (paginated) |

### Clients
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clients` | List (filter: search, status) |
| POST | `/api/clients` | Create |
| GET | `/api/clients/:id` | Get one |
| PUT | `/api/clients/:id` | Update |
| DELETE | `/api/clients/:id` | Delete |
| POST | `/api/clients/import` | Bulk import |
| GET | `/api/clients/export/pdf` | Export PDF |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Full dashboard data — stats, charts, alerts, transactions |

### Activity Log
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/activity` | Paginated log (filter: module, action, username) |
| GET | `/api/activity/users` | Distinct usernames for filter dropdowns |
| DELETE | `/api/activity` | Clear all logs (ADMIN only) |

### IoT Devices
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/iot-devices` | List all devices |
| POST | `/api/iot-devices` | Add device (ADMIN) |
| GET | `/api/iot-devices/:id` | Get one |
| PUT | `/api/iot-devices/:id` | Update (ADMIN) |
| DELETE | `/api/iot-devices/:id` | Delete (ADMIN) |
| PATCH | `/api/iot-devices/:id/ping` | Ping device → sets lastPing + ONLINE |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List users (ADMIN) |
| GET | `/api/users/me` | Own profile |
| POST | `/api/users` | Create user (ADMIN) |
| PUT | `/api/users/:id` | Update user (ADMIN) |
| DELETE | `/api/users/:id` | Delete user (ADMIN) |

### Intelligence (Civi AI)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/intelligence` | Full AI report — reorder alerts, manufacture readiness, velocity |
| POST | `/api/intelligence/chat` | Chat with Civi AI — body: `{ message, history[] }` |
| GET | `/api/intelligence/export/pdf` | Export intelligence report as PDF |

### Trial / License
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/trial/activate` | Activate license key — body: `{ key }` |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server + trial status — no auth required |

---

## Middleware Stack

Request order (top → bottom):

```
helmet()                  — security headers
cors()                    — FRONTEND_URL allowed origin
requestSizeLimit          — blocks Content-Length > 10MB
express.json()
morgan("dev")             — request logging
validateRequest           — body scan for suspicious patterns
req.prisma = prisma       — attach DB client to every request
/api/trial router         — exempt from all guards
checkIntegrity            — env var + OWNER_SIG verification (503 if violated)
checkTrial                — license expiry check (402 if expired)
API routes + rate limiters
```

---

## Roles

| Role | Access |
|------|--------|
| ADMIN | Full access — users, IoT devices, delete operations, clear logs |
| EDITOR | CRUD on inventory, clients, BOM, manufacture |
| VIEWER | Read-only on all modules |
| USER | Same as VIEWER (legacy) |

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India*
