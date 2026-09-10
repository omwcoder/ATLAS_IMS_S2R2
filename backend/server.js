// ============================================================
// S2R2 Inventory — Express API Server  (server.js)
// ============================================================
"use strict";

const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const morgan       = require("morgan");
const { PrismaClient } = require("@prisma/client");

// ── Route modules ─────────────────────────────────────────────
const rawMaterialsRouter     = require("./src/routes/rawMaterials");
const finishedProductsRouter = require("./src/routes/finishedProducts");
const clientsRouter          = require("./src/routes/clients");
const dashboardRouter        = require("./src/routes/dashboard");
const authRouter             = require("./src/routes/auth");
const activityRouter         = require("./src/routes/activity");
const iotDevicesRouter       = require("./src/routes/iotDevices");
const usersRouter            = require("./src/routes/users");
const trialRouter            = require("./src/routes/trial");
const manufactureRouter      = require("./src/routes/manufacture");
const intelligenceRouter     = require("./src/routes/intelligence");

// ── Trial / License guard ─────────────────────────────────────
const { checkTrial, getTrialStatus } = require("./src/middleware/trial");

// ── Ownership & integrity guard ───────────────────────────────
const { runIntegrityCheck, checkIntegrity } = require("./src/middleware/integrity");

// ── App setup ─────────────────────────────────────────────────
const app    = express();
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
const PORT   = process.env.PORT || 4000;

// FRONTEND_URL — warn if missing but never crash; defaults to localhost:3000
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
if (!process.env.FRONTEND_URL) {
  console.warn("[server] FRONTEND_URL not set — defaulting to http://localhost:3000 (CORS)");
}

// ── Middleware ────────────────────────────────────────────────
const { apiLimiter, authLimiter, validateTrialExpiry, validateRequest, requestSizeLimit } = require("./src/middleware/security");

app.use(helmet());
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(requestSizeLimit);
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === "production"
  ? "combined"
  : "dev",
  { skip: (req) => req.path === "/health" } // don't log health checks
));
app.use(validateRequest);

// Attach Prisma to every request
app.use((req, _res, next) => {
  req.prisma = prisma;
  next();
});

// ── Trial activation (MUST be before checkTrial so it's never blocked) ───
app.use("/api/trial", trialRouter);

// ── Integrity check on every request (after trial route, before all others) ─
app.use(checkIntegrity);

// ── Trial / License check (runs before all API routes) ────────
// Exempt: POST /api/auth/login and GET /health (see middleware/trial.js)
app.use(checkTrial);

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/raw-materials", apiLimiter, rawMaterialsRouter);
app.use("/api/finished-products", apiLimiter, finishedProductsRouter);
app.use("/api/clients", apiLimiter, clientsRouter);
app.use("/api/dashboard", apiLimiter, dashboardRouter);
app.use("/api/activity", apiLimiter, activityRouter);
app.use("/api/iot-devices", apiLimiter, iotDevicesRouter);
app.use("/api/users", apiLimiter, usersRouter);
app.use("/api/manufacture", apiLimiter, manufactureRouter);
app.use("/api/intelligence", apiLimiter, intelligenceRouter);

// Health check — also exposes trial status
app.get("/health", (_req, res) =>
  res.json({ status: "ok", ts: new Date(), trial: getTrialStatus() })
);

// ── Global error handler ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL connected via Prisma");

    // Integrity & ownership check — must pass before server opens port
    await runIntegrityCheck(prisma);

    app.listen(PORT, () =>
      console.log(`🚀 S2R2 API running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT",  async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });

start();
