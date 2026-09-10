# S2R2 Inventory — Frontend

**Next.js 14 App Router + Tailwind CSS**
Built by Civitas Atlas Technologies Pvt. Ltd., Pune, India

---

## Setup

```bash
cd frontend
cp .env.local.example .env.local   # sets NEXT_PUBLIC_API_URL=http://localhost:4000
npm install
npm run dev                        # http://localhost:3000
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint check |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL — `http://localhost:4000` locally, Railway URL in production |

All `/api/*` requests are proxied to the backend via `next.config.js` rewrites — no CORS issues.

---

## Project Structure

```
frontend/
├── app/                      Next.js App Router pages
│   ├── layout.tsx            Root layout — theme, AppShell
│   ├── page.tsx              Dashboard (4 tabs)
│   ├── login/page.tsx        Login page
│   ├── raw-materials/        Raw materials CRUD
│   ├── finished-products/    Finished products CRUD
│   ├── bom/                  Bill of Materials management
│   ├── clients/              Client CRUD
│   ├── iot-devices/          IoT device management
│   ├── intelligence/         Civi AI intelligence report
│   │   └── chat/             Civi AI chat assistant
│   ├── admin/                User management + permissions
│   ├── notifications/        Stock alert notifications
│   ├── trial-expired/        License expiry page
│   └── globals.css           Global styles
│
├── components/
│   ├── AppShell.tsx          Auth guard + layout wrapper
│   ├── Header.tsx            Top navigation bar
│   ├── Sidebar.tsx           Navigation sidebar
│   ├── Footer.tsx            Branded footer
│   └── CiviAIIcon.tsx        Animated Civi AI icon
│
├── lib/
│   ├── api.ts                All API calls — typed, centralized
│   ├── permissions.ts        Role-based permission hooks
│   ├── notifications.ts      Stock alert fetching + caching
│   ├── useTrialStatus.ts     Trial expiry hook
│   └── useInactivityTimeout.ts  Auto-logout on inactivity
│
└── types/
    └── index.ts              All TypeScript interfaces
```

---

## Pages & Routes

| Route | Page | Role Access |
|-------|------|-------------|
| `/` | Dashboard | All |
| `/login` | Login | Public |
| `/raw-materials` | Raw Materials | All (edit: EDITOR+) |
| `/finished-products` | Finished Products | All (edit: EDITOR+) |
| `/bom` | Bill of Materials | All (edit: EDITOR+) |
| `/clients` | Clients | All (edit: EDITOR+) |
| `/iot-devices` | IoT Devices | All (manage: ADMIN) |
| `/intelligence` | Civi AI Report | All |
| `/intelligence/chat` | Civi AI Chat | All |
| `/admin` | User Management | ADMIN only |
| `/notifications` | Stock Alerts | All |
| `/trial-expired` | License Expired | Public |

---

## Auth Flow

1. User submits login → `POST /api/auth/login`
2. JWT token stored in `localStorage` as `s2r2_token`
3. Username + role stored as `s2r2_username`, `s2r2_role`
4. `AppShell` checks `isLoggedIn()` on every route — redirects to `/login` if not
5. All API calls in `lib/api.ts` attach `Authorization: Bearer <token>` automatically
6. On logout → clears all localStorage keys → redirects to `/login`
7. Inactivity timeout (15 min) → auto-logout → redirects to `/login?reason=inactivity`

---

## Role Permissions

| Feature | ADMIN | EDITOR | VIEWER |
|---------|-------|--------|--------|
| View Dashboard & Reports | ✓ | ✓ | ✓ |
| View Activity Log | ✓ | ✓ | ✓ |
| Export CSV / Excel / PDF | ✓ | ✓ | ✓ |
| Add / Edit Raw Materials | ✓ | ✓ | ✗ |
| Delete Raw Materials | ✓ | ✗ | ✗ |
| Add / Edit Finished Products | ✓ | ✓ | ✗ |
| Delete Finished Products | ✓ | ✗ | ✗ |
| Add / Edit Clients | ✓ | ✓ | ✗ |
| Delete Clients | ✓ | ✗ | ✗ |
| Add / Edit IoT Devices | ✓ | ✗ | ✗ |
| Delete IoT Devices | ✓ | ✗ | ✗ |
| Manage Users | ✓ | ✗ | ✗ |
| View Pricing & Revenue | ✓ | ✓ | ✗ |

Permissions are editable by ADMIN in the Admin panel and stored in `localStorage`.

---

## Key Components

### AppShell
- Wraps every protected page
- Checks auth on mount — redirects to `/login` if no token
- Renders Header + Sidebar + content
- Handles sidebar open/collapse state
- Checks trial status — redirects to `/trial-expired` if expired

### Header
- Floating pill-style top bar
- Hide/show on scroll
- Dark/light mode toggle (persisted in localStorage)
- Stock alert bell with badge count
- Civi AI quick-access button
- User dropdown with role badge + logout

### Sidebar
- Navigation with icons for all pages
- Collapsible on desktop
- Slide-over on mobile
- Active route highlighting
- Role-aware — hides Admin link for non-ADMIN

### CiviAIIcon
- Animated SVG icon for the Civi AI assistant
- Used in Header + Intelligence pages

---

## API Client (`lib/api.ts`)

All API functions:
- Read token from `localStorage` automatically
- Handle 401 (token expired) → auto-logout
- Handle 402 (trial expired) → redirect to `/trial-expired`
- Return typed responses

Key exports:
```ts
login(username, password)
logout()
isLoggedIn()
getDashboardStats()
getRawMaterials(filters?)
createRawMaterial(data)
updateRawMaterial(id, data)
deleteRawMaterial(id)
rawMaterialInward(id, qty, note?)
rawMaterialOutward(id, qty, note?)
getFinishedProducts(filters?)
// ...all other CRUD functions
getIntelligence()
chatWithCivi(message, history)
exportIntelligencePdf()
```

---

## Excel Import Format

### Raw Materials
| Column | Required |
|--------|----------|
| Name | ✅ |
| Category | ✅ |
| Description | No |
| Qty | No |
| Unit | No |
| Supplier | No |
| Location | No |
| Min Stock | No |
| Price (₹) | No |

### Clients
| Column | Required |
|--------|----------|
| Client Name | ✅ |
| Company Name | No |
| Phone | No |
| Email | No |
| Address | No |
| GST No | No |

---

## Dark Mode

Toggled via the sun/moon button in the Header.
Stored in `localStorage` as `s2r2_theme` = `"dark"` or `"light"`.
Applied via `dark` class on `<html>` — all Tailwind dark variants work automatically.

---

*© Civitas Atlas Technologies Pvt. Ltd., Pune, India*
