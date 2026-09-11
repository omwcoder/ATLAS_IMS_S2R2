// src/routes/clients.js
"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/** Format any date value as YYYY-MM-DD HH:MM:SS (local time) */
function fmtTs(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const pad = n => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ` +
         `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

async function logActivity(prisma, username, module, label, action) {
  await prisma.activityLog.create({
    data: { module, label, action, username },
  });
}

// GET /api/clients?search=&status=
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const where = {};
    if (search) where.OR = [
      { clientName:  { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
      { email:       { contains: search, mode: "insensitive" } },
      { phone:       { contains: search, mode: "insensitive" } },
      { address:     { contains: search, mode: "insensitive" } },
    ];
    if (status) where.status = status.toUpperCase();

    const clients = await req.prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    res.json({ clients });
  } catch (err) { next(err); }
});

// GET /api/clients/:id  — must be before /export/pdf to avoid conflict
router.get("/:id(\\d+)", requireAuth, async (req, res, next) => {
  try {
    const client = await req.prisma.client.findUniqueOrThrow({
      where: { id: Number(req.params.id) },
    });
    res.json(client);
  } catch (err) { next(err); }
});

// POST /api/clients
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { clientName, companyName, phone, email, address, gstNo, status } = req.body;
    const client = await req.prisma.client.create({
      data: {
        clientName, companyName, phone, email, address, gstNo,
        status: (status || "ACTIVE").toUpperCase(),
      },
    });
    await logActivity(req.prisma, req.user.username, "client", client.clientName, "created");
    res.status(201).json(client);
  } catch (err) { next(err); }
});

// PUT /api/clients/:id
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id   = Number(req.params.id);
    const data = {};
    const fields = ["clientName","companyName","phone","email","address","gstNo","status"];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        data[f] = f === "status" ? req.body[f].toUpperCase() : req.body[f];
      }
    }
    // ADMIN can override createdAt
    if (req.body.createdAt && req.user.role === "ADMIN") {
      const d = new Date(req.body.createdAt);
      if (!isNaN(d.getTime())) data.createdAt = d;
    }
    const client = await req.prisma.client.update({ where: { id }, data });
    await logActivity(req.prisma, req.user.username, "client", client.clientName, "updated");
    res.json(client);
  } catch (err) { next(err); }
});

// DELETE /api/clients/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id     = Number(req.params.id);
    const client = await req.prisma.client.delete({ where: { id } });
    await logActivity(req.prisma, req.user.username, "client", client.clientName, "deleted");
    res.json({ message: "Deleted", id });
  } catch (err) { next(err); }
});

// POST /api/clients/import — bulk import from Excel/CSV (ADMIN + EDITOR)
router.post("/import", requireAuth, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: "rows array is required" });

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      const clientName = String(row["Client Name"] || row["clientName"] || row["client_name"] || "").trim();
      if (!clientName) { results.skipped++; continue; }

      try {
        await req.prisma.client.create({
          data: {
            clientName,
            companyName: String(row["Company"]      || row["companyName"]  || "").trim() || null,
            phone:       String(row["Phone"]         || row["phone"]        || "").trim() || null,
            email:       String(row["Email"]         || row["email"]        || "").trim() || null,
            address:     String(row["Address"]       || row["address"]      || "").trim() || null,
            gstNo:       String(row["GST No"]        || row["gstNo"]        || "").trim() || null,
            status:      "ACTIVE",
          },
        });
        await req.prisma.activityLog.create({
          data: { module: "client", label: clientName, action: "created", username: req.user.username },
        });
        results.created++;
      } catch (e) {
        // Skip duplicate emails or other constraint errors
        results.skipped++;
        results.errors.push(`${clientName}: ${e.message}`);
      }
    }

    res.json(results);
  } catch (err) { next(err); }
});
router.get("/export/pdf", requireAuth, async (req, res, next) => {
  try {
    let PDFDocument;
    try { PDFDocument = require("pdfkit"); }
    catch {
      return res.status(501).json({
        error: "PDF unavailable — run `npm install pdfkit` in the backend folder.",
      });
    }

    const clients = await req.prisma.client.findMany({ orderBy: { clientName: "asc" } });

    res.setHeader("Content-Type",        "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="clients.pdf"');

    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    doc.pipe(res);

    // ── Title ──────────────────────────────────────────────────
    doc.fontSize(18).font("Helvetica-Bold").text("S2R2 — Client List", { align: "center" });
    doc.fontSize(9).font("Helvetica").fillColor("#666")
      .text(`Generated: ${fmtTs(new Date())}  |  By: ${req.user.username}`, { align: "center" });
    doc.moveDown(1.2);

    // ── Column definitions ──────────────────────────────────────
    const cols = [
      { label: "#",          key: "id",          w: 28  },
      { label: "Name",       key: "clientName",  w: 100 },
      { label: "Company",    key: "companyName", w: 100 },
      { label: "Phone",      key: "phone",       w: 80  },
      { label: "Email",      key: "email",       w: 130 },
      { label: "GST No",     key: "gstNo",       w: 90  },
      { label: "Status",     key: "status",      w: 45  },
      { label: "Created At", key: "createdAt",   w: 105 },
      { label: "Updated At", key: "updatedAt",   w: 105 },
    ];
    const ROW_H  = 18;
    const startX = doc.page.margins.left;
    const totalW = cols.reduce((s, c) => s + c.w, 0);

    // Header row
    let x = startX;
    doc.rect(startX, doc.y, totalW, ROW_H).fill("#2563eb");
    doc.fontSize(6.5).font("Helvetica-Bold");
    cols.forEach(col => {
      doc.fillColor("#fff").text(col.label, x + 4, doc.y - ROW_H + 4, {
        width: col.w - 8, lineBreak: false,
      });
      x += col.w;
    });
    doc.moveDown(0.2);

    // Data rows
    doc.font("Helvetica").fontSize(6);
    clients.forEach((client, idx) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - ROW_H) doc.addPage();
      const rowY  = doc.y;
      const shade = idx % 2 === 0 ? "#f0f4ff" : "#ffffff";
      doc.rect(startX, rowY, totalW, ROW_H).fill(shade);
      x = startX;
      cols.forEach(col => {
        let val = String(client[col.key] ?? "—");
        if (col.key === "createdAt" || col.key === "updatedAt") val = fmtTs(client[col.key]);
        doc.fillColor("#111").text(val, x + 4, rowY + 5, {
          width: col.w - 8, lineBreak: false,
        });
        x += col.w;
      });
      doc.y = rowY + ROW_H;
    });

    // ── Branding footer on every page ───────────────────────
    const brandText = "Generated using Civi API  |  By Civitas Atlas Co, Pune";
    const range     = doc.bufferedPageRange ? doc.bufferedPageRange() : { start: 0, count: 1 };
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(7).font("Helvetica").fillColor("#888")
         .text(brandText,
           doc.page.margins.left,
           doc.page.height - doc.page.margins.bottom + 6,
           { align: "center", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
         );
    }

    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;
