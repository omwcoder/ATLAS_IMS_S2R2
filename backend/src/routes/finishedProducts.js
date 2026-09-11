// src/routes/finishedProducts.js
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
  await prisma.activityLog.create({ data: { module, label, action, username } });
}

// ── helper: compute stock status (mirrors raw materials logic) ──
function computeStatus(qty, minStock) {
  if (qty === 0)              return "out";
  if (qty <= minStock)        return "low";
  return "active";
}

// ── helper: serialize product with computed stockStatus ─────────
function serialize(p) {
  return {
    ...p,
    stockStatus: computeStatus(p.qty, p.minStock ?? 0),
  };
}

// GET /api/finished-products?search=&status=&stockStatus=
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { search, status, stockStatus } = req.query;
    const where = {};
    if (search) where.name = { contains: search, mode: "insensitive" };
    if (status) where.status = status.toUpperCase();

    let products = await req.prisma.finishedProduct.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    // filter by computed stock status if requested
    if (stockStatus) {
      products = products.filter(p => computeStatus(p.qty, p.minStock ?? 0) === stockStatus);
    }

    res.json({ products: products.map(serialize) });
  } catch (err) { next(err); }
});

// POST /api/finished-products/import — bulk import from Excel
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
        await req.prisma.finishedProduct.create({
          data: {
            name,
            qty:      Number(row["Qty"]          || row["qty"]      || 0),
            unit:     String(row["Unit"]         || row["unit"]     || "Box").trim(),
            category: String(row["Category"]     || row["category"] || "Finished Products").trim(),
            location: String(row["Location"]     || row["location"] || "").trim() || null,
            supplier: String(row["Supplier"]     || row["supplier"] || "").trim() || null,
            minStock: Number(row["Min Stock"]    || row["minStock"] || 0),
            price:    Number(row["Price (₹)"]   || row["price"]    || 0),
            status:   "ACTIVE",
          },
        });
        await req.prisma.activityLog.create({
          data: { module: "finished_product", label: name, action: "created", username: req.user.username },
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

// GET /api/finished-products/export/pdf
router.get("/export/pdf", requireAuth, async (req, res, next) => {
  try {
    let PDFDocument;
    try { PDFDocument = require("pdfkit"); }
    catch { return res.status(501).json({ error: "Run `npm install pdfkit` in the backend folder." }); }

    const products = await req.prisma.finishedProduct.findMany({ orderBy: { name: "asc" } });

    res.setHeader("Content-Type",        "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="finished-products.pdf"');

    const doc  = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const cols = [
      { label: "ID",          key: "id",        w: 30  },
      { label: "Name",        key: "name",      w: 110 },
      { label: "Qty",         key: "qty",       w: 38  },
      { label: "Unit",        key: "unit",      w: 45  },
      { label: "Category",    key: "category",  w: 90  },
      { label: "Location",    key: "location",  w: 80  },
      { label: "Supplier",    key: "supplier",  w: 80  },
      { label: "Min Stock",   key: "minStock",  w: 50  },
      { label: "Price (₹)",   key: "price",     w: 60  },
      { label: "Status",      key: "status",    w: 50  },
      { label: "Created At",  key: "createdAt", w: 105 },
      { label: "Updated At",  key: "updatedAt", w: 105 },
    ];
    const ROW_H  = 18;
    const startX = doc.page.margins.left;
    const totalW = cols.reduce((s, c) => s + c.w, 0);

    doc.fontSize(16).font("Helvetica-Bold")
       .text("S2R2 — Finished Products", { align: "center" });
    doc.fontSize(9).font("Helvetica").fillColor("#666")
       .text(`Generated: ${fmtTs(new Date())}  |  By: ${req.user.username}`, { align: "center" });
    doc.moveDown(1.2);

    // header row
    let x = startX;
    doc.rect(startX, doc.y, totalW, ROW_H).fill("#059669");
    doc.fontSize(6.5).font("Helvetica-Bold");
    cols.forEach(col => {
      doc.fillColor("#fff").text(col.label, x + 4, doc.y - ROW_H + 4, { width: col.w - 8, lineBreak: false });
      x += col.w;
    });
    doc.moveDown(0.2);

    // data rows
    doc.font("Helvetica").fontSize(6);
    products.forEach((p, idx) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - ROW_H) doc.addPage();
      const rowY  = doc.y;
      const shade = idx % 2 === 0 ? "#ecfdf5" : "#ffffff";
      doc.rect(startX, rowY, totalW, ROW_H).fill(shade);
      x = startX;
      cols.forEach(col => {
        let val = col.key === "minStock" ? (p.minStock ?? 0) : (p[col.key] ?? "—");
        if (col.key === "createdAt" || col.key === "updatedAt") val = fmtTs(val);
        doc.fillColor("#111").text(String(val), x + 4, rowY + 5, { width: col.w - 8, lineBreak: false });
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

    doc.pipe(res);
    doc.end();
  } catch (err) { next(err); }
});

// GET /api/finished-products/:id
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const product = await req.prisma.finishedProduct.findUniqueOrThrow({
      where: { id: Number(req.params.id) },
    });
    res.json(serialize(product));
  } catch (err) { next(err); }
});

// POST /api/finished-products
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, qty, unit, category, location, supplier, minStock, price, status } = req.body;
    const product = await req.prisma.finishedProduct.create({
      data: {
        name,
        qty:      Number(qty ?? 0),
        unit:     unit     || "Box",
        category: category || "Finished Products",
        location: location || null,
        supplier: supplier || null,
        minStock: Number(minStock ?? 0),
        price:    Number(price    ?? 0),
        status:   (status || "ACTIVE").toUpperCase(),
      },
    });
    await logActivity(req.prisma, req.user.username, "finished_product", product.name, "created");
    res.status(201).json(serialize(product));
  } catch (err) { next(err); }
});

// PUT /api/finished-products/:id
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const id   = Number(req.params.id);
    const data = {};
    if (req.body.name     !== undefined) data.name     = req.body.name;
    if (req.body.qty      !== undefined) data.qty      = Number(req.body.qty);
    if (req.body.unit     !== undefined) data.unit     = req.body.unit;
    if (req.body.category !== undefined) data.category = req.body.category;
    if (req.body.location !== undefined) data.location = req.body.location || null;
    if (req.body.supplier !== undefined) data.supplier = req.body.supplier || null;
    if (req.body.minStock !== undefined) data.minStock = Number(req.body.minStock);
    if (req.body.price    !== undefined) data.price    = Number(req.body.price);
    if (req.body.status   !== undefined) data.status   = req.body.status.toUpperCase();
    // ADMIN can override updatedAt
    if (req.body.updatedAt && req.user.role === "ADMIN") {
      const d = new Date(req.body.updatedAt);
      if (!isNaN(d.getTime())) data.updatedAt = d;
    }
    const product = await req.prisma.finishedProduct.update({ where: { id }, data });
    await logActivity(req.prisma, req.user.username, "finished_product", product.name, "updated");
    res.json(serialize(product));
  } catch (err) { next(err); }
});

// DELETE /api/finished-products/:id
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const id      = Number(req.params.id);
    const product = await req.prisma.finishedProduct.delete({ where: { id } });
    await logActivity(req.prisma, req.user.username, "finished_product", product.name, "deleted");
    res.json({ message: "Deleted", id });
  } catch (err) { next(err); }
});

module.exports = router;
