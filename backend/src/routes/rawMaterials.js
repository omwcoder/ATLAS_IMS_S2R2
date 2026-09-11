// src/routes/rawMaterials.js
"use strict";

const express = require("express");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function deriveStatus(item) {
  if (item.quantity === 0)            return "out";
  if (item.quantity <= item.minStock) return "low";
  return "active";
}

async function logActivity(prisma, username, module, label, action) {
  await prisma.activityLog.create({ data: { module, label, action, username } });
}

// ── Helpers shared by both PDF routes ─────────────────────────

/** Format any date value as YYYY-MM-DD HH:MM:SS (local time) */
function fmtTs(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const pad = n => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ` +
         `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}

function buildPdf(PDFDocument, items, generatedBy) {
  const doc    = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const cols   = [
    { label: "ID",          key: "id",          w: 25  },
    { label: "Name",        key: "name",         w: 90  },
    { label: "Category",    key: "category",     w: 70  },
    { label: "Qty",         key: "quantity",     w: 35  },
    { label: "Unit",        key: "unit",         w: 30  },
    { label: "Supplier",    key: "supplier",     w: 75  },
    { label: "Location",    key: "location",     w: 65  },
    { label: "Min",         key: "minStock",     w: 28  },
    { label: "Price ₹",     key: "price",        w: 50  },
    { label: "Status",      key: "status",       w: 45  },
    { label: "Last Updated",key: "lastUpdated",  w: 105 },
    { label: "Created At",  key: "createdAt",    w: 105 },
  ];
  const ROW_H  = 18;
  const startX = doc.page.margins.left;
  const totalW = cols.reduce((s, c) => s + c.w, 0);

  doc.fontSize(16).font("Helvetica-Bold")
     .text("S2R2 — Raw Materials", { align: "center" });
  doc.fontSize(9).font("Helvetica").fillColor("#666")
     .text(`Generated: ${fmtTs(new Date())}  |  By: ${generatedBy}`, { align: "center" });
  doc.moveDown(1.2);

  // Header row
  let x = startX;
  doc.rect(startX, doc.y, totalW, ROW_H).fill("#1d4ed8");
  doc.fontSize(6.5).font("Helvetica-Bold");
  cols.forEach(col => {
    doc.fillColor("#fff").text(col.label, x + 3, doc.y - ROW_H + 5, { width: col.w - 6, lineBreak: false });
    x += col.w;
  });
  doc.moveDown(0.2);

  doc.font("Helvetica").fontSize(6);
  items.forEach((item, idx) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - ROW_H) doc.addPage();
    const rowY  = doc.y;
    const shade = idx % 2 === 0 ? "#eff6ff" : "#ffffff";
    doc.rect(startX, rowY, totalW, ROW_H).fill(shade);
    x = startX;
    cols.forEach(col => {
      let val = item[col.key] ?? "—";
      if (col.key === "price")        val = `${Number(val).toLocaleString()}`;
      if (col.key === "status")       val = String(val).toUpperCase();
      if (col.key === "lastUpdated" || col.key === "createdAt") val = fmtTs(val);
      doc.fillColor("#111").text(String(val), x + 3, rowY + 5, { width: col.w - 6, lineBreak: false });
      x += col.w;
    });
    doc.y = rowY + ROW_H;
  });

  // ── Branding footer on every page ─────────────────────────
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

  return doc;
}

// GET /api/raw-materials?search=&category=&status=
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { search, category, status } = req.query;
    const where = {};
    if (search)   where.OR = [
      { name:        { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { supplier:    { contains: search, mode: "insensitive" } },
    ];
    if (category) where.category = category;
    let items = await req.prisma.rawMaterial.findMany({ where, orderBy: { updatedAt: "desc" } });
    if (status)   items = items.filter(i => deriveStatus(i) === status);
    res.json({ items: items.map(i => ({ ...i, status: deriveStatus(i) })) });
  } catch (err) { next(err); }
});

// POST /api/raw-materials/import — bulk import from Excel
router.post("/import", requireAuth, async (req, res, next) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0)
      return res.status(400).json({ error: "rows array is required" });

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      const name = String(row["Name"] || row["name"] || "").trim();
      if (!name) { results.skipped++; continue; }
      try {
        await req.prisma.rawMaterial.create({
          data: {
            name,
            category:    String(row["Category"]    || row["category"]    || "General").trim(),
            description: String(row["Description"] || row["description"] || "").trim() || null,
            quantity:    Number(row["Qty"]          || row["quantity"]    || 0),
            unit:        String(row["Unit"]         || row["unit"]        || "pcs").trim(),
            supplier:    String(row["Supplier"]     || row["supplier"]    || "").trim() || null,
            location:    String(row["Location"]     || row["location"]    || "").trim() || null,
            minStock:    Number(row["Min Stock"]    || row["minStock"]    || 0),
            price:       Number(row["Price (₹)"]   || row["price"]       || 0),
          },
        });
        await req.prisma.activityLog.create({
          data: { module: "raw_material", label: name, action: "created", username: req.user.username },
        });
        results.created++;
      } catch (e) {
        results.skipped++;
        results.errors.push(`${name}: ${e.message}`);
      }
    }
    res.json(results);
  } catch (err) { next(err); }
});

// GET /api/raw-materials/export/pdf
router.get("/export/pdf", requireAuth, async (req, res, next) => {
  try {
    let PDFDocument;
    try { PDFDocument = require("pdfkit"); }
    catch { return res.status(501).json({ error: "Run `npm install pdfkit` in the backend folder." }); }

    const items = await req.prisma.rawMaterial.findMany({ orderBy: { name: "asc" } });
    const withStatus = items.map(i => ({ ...i, status: deriveStatus(i) }));

    res.setHeader("Content-Type",        "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="raw-materials.pdf"');
    const doc = buildPdf(PDFDocument, withStatus, req.user.username);
    doc.pipe(res);
    doc.end();
  } catch (err) { next(err); }
});

// GET /api/raw-materials/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const item = await req.prisma.rawMaterial.findUniqueOrThrow({ where: { id: Number(req.params.id) } });
    res.json({ ...item, status: deriveStatus(item) });
  } catch (err) { next(err); }
});

// POST /api/raw-materials
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, category, description, quantity, unit, supplier, location, minStock, price } = req.body;
    const item = await req.prisma.rawMaterial.create({
      data: { name, category, description, quantity: Number(quantity), unit, supplier, location, minStock: Number(minStock), price: Number(price) },
    });
    await logActivity(req.prisma, req.user.username, "raw_material", item.name, "created");
    res.status(201).json({ ...item, status: deriveStatus(item) });
  } catch (err) { next(err); }
});

// PUT /api/raw-materials/:id
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id   = Number(req.params.id);
    const data = {};
    const fields = ["name","category","description","quantity","unit","supplier","location","minStock","price"];
    for (const f of fields) {
      if (req.body[f] !== undefined)
        data[f] = ["quantity","minStock","price"].includes(f) ? Number(req.body[f]) : req.body[f];
    }
    data.lastUpdated = new Date();
    const item = await req.prisma.rawMaterial.update({ where: { id }, data });
    await logActivity(req.prisma, req.user.username, "raw_material", item.name, "updated");
    res.json({ ...item, status: deriveStatus(item) });
  } catch (err) { next(err); }
});

// DELETE /api/raw-materials/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id   = Number(req.params.id);
    const item = await req.prisma.rawMaterial.delete({ where: { id } });
    await logActivity(req.prisma, req.user.username, "raw_material", item.name, "deleted");
    res.json({ message: "Deleted", id });
  } catch (err) { next(err); }
});

// ── POST /api/raw-materials/:id/inward ────────────────────────
// Body: { quantity, note? }
// Adds stock — used when raw materials are received from suppliers.
router.post("/:id/inward", requireAuth, async (req, res, next) => {
  try {
    const id  = Number(req.params.id);
    const qty = Number(req.body.quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: "quantity must be a positive number" });

    const item = await req.prisma.rawMaterial.findUniqueOrThrow({ where: { id } });
    const updated = await req.prisma.rawMaterial.update({
      where: { id },
      data:  { quantity: { increment: qty }, lastUpdated: new Date() },
    });

    await req.prisma.inventoryTransaction.create({
      data: {
        transactionType: "INWARD",
        itemType:        "RAW_MATERIAL",
        itemId:          id,
        itemName:        item.name,
        quantity:        qty,
        note:            req.body.note || null,
        performedBy:     req.user.username,
      },
    });

    await logActivity(req.prisma, req.user.username, "raw_material", `${item.name} +${qty} (INWARD)`, "updated");
    res.json({ message: "Inward recorded", item: { ...updated, status: deriveStatus(updated) }, transactionType: "INWARD" });
  } catch (err) { next(err); }
});

// ── POST /api/raw-materials/:id/outward ───────────────────────
// Body: { quantity, note? }
// Reduces stock — used when raw materials are consumed or issued manually.
router.post("/:id/outward", requireAuth, async (req, res, next) => {
  try {
    const id  = Number(req.params.id);
    const qty = Number(req.body.quantity);
    if (!qty || qty <= 0) return res.status(400).json({ error: "quantity must be a positive number" });

    const item = await req.prisma.rawMaterial.findUniqueOrThrow({ where: { id } });
    if (item.quantity < qty) {
      return res.status(422).json({
        error:     `Insufficient stock. Available: ${item.quantity} ${item.unit}, Requested: ${qty}`,
        available: item.quantity,
        requested: qty,
      });
    }

    const updated = await req.prisma.rawMaterial.update({
      where: { id },
      data:  { quantity: { decrement: qty }, lastUpdated: new Date() },
    });

    await req.prisma.inventoryTransaction.create({
      data: {
        transactionType: "OUTWARD",
        itemType:        "RAW_MATERIAL",
        itemId:          id,
        itemName:        item.name,
        quantity:        -qty,
        note:            req.body.note || null,
        performedBy:     req.user.username,
      },
    });

    await logActivity(req.prisma, req.user.username, "raw_material", `${item.name} -${qty} (OUTWARD)`, "updated");

    // Check for low-stock alert after deduction
    const stockStatus = deriveStatus(updated);
    res.json({
      message:       "Outward recorded",
      item:          { ...updated, status: stockStatus },
      transactionType: "OUTWARD",
      lowStockAlert: stockStatus !== "active",
    });
  } catch (err) { next(err); }
});

module.exports = router;
