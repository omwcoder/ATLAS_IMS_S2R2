"use client";
export const dynamic = "force-dynamic";
// app/raw-materials/page.tsx — Full CRUD + Inward/Outward + Excel Import + Export
import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/AppShell";
import {
  getRawMaterials, createRawMaterial,
  updateRawMaterial, deleteRawMaterial,
  inwardRawMaterial, outwardRawMaterial,
  importRawMaterials,
} from "@/lib/api";
import { usePermissions, canViewPricing } from "@/lib/permissions";
import { RawMaterial } from "@/types";
import {
  Search, Plus, X, FileSpreadsheet, FileText,
  Download, Pencil, Trash2, Package, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, CheckCircle2,
  Loader2, Upload, TableProperties, AlertCircle,
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Format any date string as YYYY-MM-DD HH:MM:SS */
function fmtTs(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth()+1)}-${p(dt.getDate())} ` +
         `${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`;
}

/** Convert ISO string → datetime-local input value (YYYY-MM-DDTHH:MM) */
function toDatetimeLocal(d?: string | null): string {
  if (!d) return new Date(new Date().getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return toDatetimeLocal(null);
  return new Date(dt.getTime() - dt.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
const BRAND = "Generated using Civi API | By Civitas Atlas Co, Pune";

async function xlsxExport(rows: Record<string, unknown>[], sheet: string, file: string) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([[BRAND], []]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: -1 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), file);
}

function pdfExport(token: string) {
  fetch("/api/raw-materials/export/pdf", { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (!r.ok) throw new Error("PDF failed"); return r.blob(); })
    .then(blob => downloadBlob(blob, "raw-materials.pdf"))
    .catch(console.error);
}

async function downloadImportTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    [BRAND], [],
    ["Name", "Category", "Description", "Qty", "Unit", "Supplier", "Location", "Min Stock", "Price (₹)"],
    ["ESP32 Module", "Electronics", "WiFi microcontroller", 100, "pcs", "Espressif", "Warehouse A", 20, 450],
    ["Temperature Sensor", "Sensors", "Digital I2C sensor", 50, "pcs", "Adafruit", "Warehouse A", 10, 180],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Raw Materials");
  downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "raw-materials-import-template.xlsx");
}

const EMPTY: Omit<RawMaterial, "id" | "status" | "lastUpdated" | "createdAt" | "updatedAt"> = {
  name: "", category: "Electronics", description: "", quantity: 0,
  unit: "pcs", supplier: "", location: "", minStock: 0, price: 0,
};

function StatusBadge({ status }: { status: RawMaterial["status"] }) {
  const cfg = {
    active: { cls: "badge-green", label: "In Stock"    },
    low:    { cls: "badge-yellow", label: "Low Stock"  },
    out:    { cls: "badge-red",   label: "Out of Stock" },
  } as const;
  return <span className={cfg[status].cls}>{cfg[status].label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

type ImportRow = Record<string, unknown>;
type ImportState = "idle" | "preview" | "importing" | "done";

export default function RawMaterialsPage() {
  const { canAdd, canEdit, canDelete, isAdmin } = usePermissions("raw-material");
  const [items,    setItems]    = useState<RawMaterial[]>([]);
  const [filtered, setFiltered] = useState<RawMaterial[]>([]);
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("");
  const [status,   setStatus]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [view,     setView]     = useState<"grid" | "table">(
    () => (typeof window !== "undefined" ? localStorage.getItem("s2r2_view_mode") as "grid" | "table" : null) || "grid"
  );
  const [modal,    setModal]    = useState<Partial<typeof EMPTY & { id?: number; status?: string }> | null>(null);
  const [isNew,    setIsNew]    = useState(false);
  const [sortCol,  setSortCol]  = useState<keyof RawMaterial>("name");
  const [sortDir,  setSortDir]  = useState<"asc" | "desc">("asc");

  // Inward / Outward
  type StockAction = { type: "inward" | "outward"; item: RawMaterial };
  const [stockModal,  setStockModal]  = useState<StockAction | null>(null);
  const [stockQty,    setStockQty]    = useState(1);
  const [stockNote,   setStockNote]   = useState("");
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError,  setStockError]  = useState("");
  const [stockResult, setStockResult] = useState<string | null>(null);

  // Excel import
  const [importState,  setImportState]  = useState<ImportState>("idle");
  const [importRows,   setImportRows]   = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [importError,  setImportError]  = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("s2r2_token") || "" : "";

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try { const { items } = await getRawMaterials(); setItems(items); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    let result = items.filter(item => {
      const q = search.toLowerCase();
      const matchText = !q || `${item.name} ${item.description ?? ""} ${item.supplier ?? ""}`.toLowerCase().includes(q);
      return matchText && (!category || item.category === category) && (!status || item.status === status);
    });
    result = [...result].sort((a, b) => {
      const cmp = String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    setFiltered(result);
  }, [items, search, category, status, sortCol, sortDir]);

  function openAdd()                { setIsNew(true);  setModal({ ...EMPTY }); }
  function openEdit(i: RawMaterial) { setIsNew(false); setModal({ ...i }); }
  function closeModal()             { setModal(null); }

  function openStock(type: "inward" | "outward", item: RawMaterial) {
    setStockModal({ type, item });
    setStockQty(1); setStockNote(""); setStockError(""); setStockResult(null);
  }

  function toggleSort(col: keyof RawMaterial) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    try {
      if (isNew) await createRawMaterial(modal as Partial<RawMaterial>);
      else       await updateRawMaterial(modal.id!, modal as Partial<RawMaterial>);
      closeModal(); fetchItems();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteRawMaterial(id); fetchItems();
  }

  async function handleStockAction(e: React.FormEvent) {
    e.preventDefault();
    if (!stockModal) return;
    setStockError(""); setStockSaving(true);
    try {
      if (stockModal.type === "inward") {
        await inwardRawMaterial(stockModal.item.id, { quantity: stockQty, note: stockNote });
        setStockResult(`✅ Added ${stockQty} ${stockModal.item.unit} of ${stockModal.item.name}.`);
      } else {
        await outwardRawMaterial(stockModal.item.id, { quantity: stockQty, note: stockNote });
        setStockResult(`✅ Issued ${stockQty} ${stockModal.item.unit} of ${stockModal.item.name}.`);
      }
      fetchItems();
    } catch (err: unknown) {
      setStockError((err as Error).message || "Operation failed");
    } finally { setStockSaving(false); }
  }

  // ── Excel import handlers ────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(""); setImportRows([]);
    try {
      const XLSX = await import("xlsx");
      const wb   = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "" });
      // Skip branding rows that have no Name field
      const data = raw.filter(r => String(r["Name"] || r["name"] || "").trim());
      if (data.length === 0) { setImportError("No valid rows found. Check column headers match the template."); return; }
      setImportRows(data);
      setImportState("preview");
    } catch {
      setImportError("Could not read file. Please use the Excel template.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleImportConfirm() {
    setImportState("importing");
    try {
      const result = await importRawMaterials(importRows);
      setImportResult(result);
      setImportState("done");
      fetchItems();
    } catch (err: unknown) {
      setImportError((err as Error).message || "Import failed");
      setImportState("preview");
    }
  }

  function resetImport() {
    setImportState("idle"); setImportRows([]); setImportResult(null); setImportError("");
  }

  // ── exports ──────────────────────────────────────────────────
  function exportCsv() {
    import("papaparse").then(({ default: Papa }) => {
      const rows = filtered.map(i => ({
        ID: i.id, Name: i.name, Category: i.category, Qty: i.quantity,
        Unit: i.unit, Supplier: i.supplier ?? "", Location: i.location ?? "",
        "Min Stock": i.minStock, "Price (₹)": i.price,
        "Stock Value (₹)": i.quantity * i.price, Status: i.status,
        "Last Updated": fmtTs(i.lastUpdated),
        "Created At":   fmtTs(i.createdAt),
      }));
      const csv = BRAND + "\n\n" + Papa.unparse(rows);
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "raw-materials.csv");
    });
  }

  const totalQty        = items.reduce((s, i) => s + i.quantity, 0);
  const lowCount        = items.filter(i => i.status === "low" || i.status === "out").length;
  const totalStockValue = items.reduce((s, i) => s + i.quantity * i.price, 0);
  const categories      = Array.from(new Set(items.map(i => i.category))).sort();
  const outItems        = items.filter(i => i.status === "out");
  const lowItems        = items.filter(i => i.status === "low");

  function SortIcon({ col }: { col: keyof RawMaterial }) {
    if (sortCol !== col) return <ChevronDown size={10} className="opacity-30" />;
    return sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  }
  const TH = ({ col, label }: { col: keyof RawMaterial; label: string }) => (
    <th onClick={() => toggleSort(col)}
      className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400">
      <span className="inline-flex items-center gap-1">{label}<SortIcon col={col} /></span>
    </th>
  );

  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl mx-auto">

        {/* ── Header ───────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Package size={22} className="text-blue-600" /> Raw Materials
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">Add, edit, delete, import and export inventory items</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            {canAdd && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
                <button onClick={downloadImportTemplate}
                  className="btn btn-sm bg-gray-600 text-white hover:bg-gray-700 gap-1.5 px-3 py-2 text-sm">
                  <TableProperties size={14}/> Template
                </button>
                <button onClick={() => { setImportError(""); fileRef.current?.click(); }}
                  className="btn bg-violet-600 text-white hover:bg-violet-700 gap-1.5 px-4 py-2 text-sm font-semibold">
                  <Upload size={15}/> Import Excel
                </button>
                <button onClick={openAdd} className="btn-primary gap-2 px-4 py-2 text-sm">
                  <Plus size={15} /> Add Material
                </button>
              </>
            )}
            {!canAdd && (
              <button onClick={openAdd} className="btn-primary gap-2 self-start">
                <Plus size={16} /> Add Material
              </button>
            )}
          </div>
        </div>

        {/* ── Alerts ───────────────────────────────────── */}
        {outItems.length > 0 && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={18} />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400 text-sm">
                  {outItems.length} item{outItems.length > 1 ? "s" : ""} out of stock
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1 flex flex-wrap gap-1">
                  {outItems.map(i => <span key={i.id} className="bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">{i.name}</span>)}
                </p>
              </div>
            </div>
          </div>
        )}
        {lowItems.length > 0 && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-500 mt-0.5 shrink-0" size={18} />
              <div>
                <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                  {lowItems.length} item{lowItems.length > 1 ? "s" : ""} running low
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1 flex flex-wrap gap-1">
                  {lowItems.map(i => <span key={i.id} className="bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">{i.name} ({i.quantity}/{i.minStock} {i.unit})</span>)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Summary chips ─────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Total Items",   value: items.length,                                    cls: "bg-blue-50   text-blue-700   dark:bg-blue-900/30" },
            { label: "Total Qty",     value: totalQty,                                        cls: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30" },
            { label: "Low / Out",     value: lowCount,                                        cls: "bg-red-50    text-red-700    dark:bg-red-900/30" },
            { label: "Stock Value",   value: `₹${totalStockValue.toLocaleString("en-IN")}`,   cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30" },
            { label: "Showing",       value: filtered.length,                                 cls: "bg-gray-100  text-gray-700   dark:bg-gray-800" },
          ].map(s => (
            <div key={s.label} className={`px-4 py-2 rounded-xl text-sm font-semibold ${s.cls}`}>
              {s.label}: <strong>{s.value}</strong>
            </div>
          ))}
        </div>

        {/* ── Toolbar ──────────────────────────────────── */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, description, supplier…" className="form-input pl-9" />
            </div>
            <select value={category} onChange={e => setCategory(e.target.value)} className="form-select w-40">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="form-select w-36">
              <option value="">All Status</option>
              <option value="active">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0">
              {(["grid","table"] as const).map(v => (
                <button key={v} onClick={() => {
                  setView(v);
                  localStorage.setItem("s2r2_view_mode", v);
                }}
                  className={`px-3 py-2 text-xs font-semibold transition capitalize ${view === v ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"}`}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={fetchItems} className="btn-secondary btn-sm" title="Refresh">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={exportCsv} className="btn btn-sm bg-sky-600 text-white hover:bg-sky-700 gap-1"><FileText size={12}/>CSV</button>
            <button onClick={() => xlsxExport(filtered.map(i => ({
              ID: i.id, Name: i.name, Category: i.category, Qty: i.quantity, Unit: i.unit,
              Supplier: i.supplier ?? "", Location: i.location ?? "", "Min Stock": i.minStock,
              "Price (₹)": i.price, "Stock Value (₹)": i.quantity * i.price, Status: i.status,
              "Last Updated": fmtTs(i.lastUpdated),
              "Created At":   fmtTs(i.createdAt),
            })), "Raw Materials", "raw-materials.xlsx")}
              className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 gap-1"><FileSpreadsheet size={12}/>Excel</button>
            <button onClick={() => pdfExport(token)} className="btn btn-sm bg-red-600 text-white hover:bg-red-700 gap-1"><Download size={12}/>PDF</button>
            {(search || category || status) && (
              <button onClick={() => { setSearch(""); setCategory(""); setStatus(""); }} className="btn-secondary btn-sm">
                <X size={12}/> Reset
              </button>
            )}
          </div>
          {/* Import error inline */}
          {importError && (
            <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <AlertCircle size={14} className="shrink-0"/>{importError}
            </div>
          )}
        </div>

        {/* ── Content ──────────────────────────────────── */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="card h-52 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card py-20 text-center text-gray-400">
            <Package size={56} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No materials found</p>
            <p className="text-sm mt-1">Try adjusting filters or{" "}
              <button onClick={openAdd} className="text-blue-600 hover:underline">add a new item</button>
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => (
              <div key={item.id} className="card p-5 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="font-bold text-gray-800 dark:text-white truncate">{item.name}</h3>
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full mt-1 inline-block">{item.category}</span>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
                {item.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{item.description}</p>}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-4">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Quantity</p>
                    <p className="font-bold text-blue-600 dark:text-blue-400">{item.quantity} <span className="text-xs font-normal text-gray-400">{item.unit}</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Min Stock</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">{item.minStock} <span className="text-xs font-normal text-gray-400">{item.unit}</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Supplier</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300 truncate">{item.supplier || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Location</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300 truncate">{item.location || "—"}</p>
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Unit Price</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">₹{item.price.toLocaleString("en-IN")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Stock Value</p>
                      <p className="font-bold text-purple-600 dark:text-purple-400">₹{(item.quantity * item.price).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 font-mono mb-2">Updated: {fmtTs(item.lastUpdated)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {canEdit && <>
                      <button onClick={() => openStock("inward", item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold transition">
                        <ArrowDownCircle size={12}/> Inward
                      </button>
                      <button onClick={() => openStock("outward", item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 text-xs font-semibold transition">
                        <ArrowUpCircle size={12}/> Outward
                      </button>
                    </>}
                    <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && <button onClick={() => openEdit(item)} className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition" title="Edit"><Pencil size={14}/></button>}
                      {canDelete && <button onClick={() => handleDelete(item.id, item.name)} className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition" title="Delete"><Trash2 size={14}/></button>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <TH col="name"     label="Name"      />
                    <TH col="category" label="Category"  />
                    <TH col="quantity" label="Qty"        />
                    <TH col="unit"     label="Unit"      />
                    <TH col="supplier" label="Supplier"  />
                    <TH col="location" label="Location"  />
                    <TH col="minStock" label="Min Stock" />
                    <TH col="price"    label="Price"     />
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Stock Value</th>
                    <TH col="status"   label="Status"    />
                    <TH col="lastUpdated" label="Last Updated" />
                    <TH col="createdAt"   label="Created At"   />
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id}>
                      <td className="font-semibold text-gray-800 dark:text-white">{item.name}</td>
                      <td><span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{item.category}</span></td>
                      <td className="font-semibold text-blue-600 dark:text-blue-400">{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td>{item.supplier || "—"}</td>
                      <td>{item.location || "—"}</td>
                      <td>{item.minStock}</td>
                      <td className="font-semibold text-emerald-600 dark:text-emerald-400">₹{item.price.toLocaleString("en-IN")}</td>
                      <td className="font-semibold text-purple-600 dark:text-purple-400">₹{(item.quantity * item.price).toLocaleString("en-IN")}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">{fmtTs(item.lastUpdated)}</td>
                      <td className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">{fmtTs(item.createdAt)}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {canEdit && <>
                            <button onClick={() => openStock("inward",  item)} title="Inward"  className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-100 transition"><ArrowDownCircle size={13}/></button>
                            <button onClick={() => openStock("outward", item)} title="Outward" className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition"><ArrowUpCircle size={13}/></button>
                            <button onClick={() => openEdit(item)} title="Edit" className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition"><Pencil size={13}/></button>
                          </>}
                          {canDelete && <button onClick={() => handleDelete(item.id, item.name)} title="Delete" className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition"><Trash2 size={13}/></button>}
                          {!canEdit && !canDelete && <span className="text-xs text-gray-400 italic">View only</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── CRUD Modal ───────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{isNew ? "Add Raw Material" : "Edit Raw Material"}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{isNew ? "Fill in details to create a new item" : `Editing: ${modal.name}`}</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={18}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Field label="Name *">
                  <input value={modal.name ?? ""} onChange={e => setModal({ ...modal, name: e.target.value })} required className="form-input" placeholder="e.g. PLC Controller"/>
                </Field>
              </div>
              <Field label="Category *">
                <input list="cats" value={modal.category ?? ""} onChange={e => setModal({ ...modal, category: e.target.value })} required className="form-input"/>
                <datalist id="cats">{categories.map(c => <option key={c} value={c}/>)}<option value="Electronics"/><option value="Sensors"/></datalist>
              </Field>
              <Field label="Unit *">
                <input list="units" value={modal.unit ?? ""} onChange={e => setModal({ ...modal, unit: e.target.value })} required className="form-input" placeholder="pcs, m, kg…"/>
                <datalist id="units"><option value="pcs"/><option value="m"/><option value="kg"/><option value="L"/><option value="box"/></datalist>
              </Field>
              <Field label="Quantity *">
                <input type="number" min={0} step="any" value={modal.quantity ?? 0} onChange={e => setModal({ ...modal, quantity: Number(e.target.value) })} required className="form-input"/>
              </Field>
              <Field label="Min Stock *">
                <input type="number" min={0} step="any" value={modal.minStock ?? 0} onChange={e => setModal({ ...modal, minStock: Number(e.target.value) })} required className="form-input"/>
              </Field>
              <Field label="Unit Price (₹) *">
                <input type="number" min={0} step="any" value={modal.price ?? 0} onChange={e => setModal({ ...modal, price: Number(e.target.value) })} required className="form-input"/>
              </Field>
              <Field label="Supplier">
                <input value={modal.supplier ?? ""} onChange={e => setModal({ ...modal, supplier: e.target.value })} className="form-input" placeholder="e.g. Siemens"/>
              </Field>
              <Field label="Location">
                <input value={modal.location ?? ""} onChange={e => setModal({ ...modal, location: e.target.value })} className="form-input" placeholder="e.g. Warehouse A"/>
              </Field>
              <div className="md:col-span-2">
                <Field label="Description">
                  <textarea rows={3} value={modal.description ?? ""} onChange={e => setModal({ ...modal, description: e.target.value })} className="form-input resize-none" placeholder="Optional…"/>
                </Field>
              </div>
              {/* Timestamps — editable for ADMIN, read-only for others */}
              {(!isNew || isAdmin) && (
                <div className="md:col-span-2 grid grid-cols-2 gap-4 pt-1 border-t border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">
                      Last Updated {isAdmin && <span className="text-blue-500 normal-case">(editable)</span>}
                    </p>
                    {isAdmin ? (
                      <input
                        type="datetime-local"
                        className="form-input text-xs font-mono"
                        value={toDatetimeLocal((modal as Partial<RawMaterial>).lastUpdated)}
                        onChange={e => setModal({ ...modal, lastUpdated: e.target.value ? new Date(e.target.value).toISOString() : undefined } as typeof modal)}
                      />
                    ) : (
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                        {fmtTs((modal as Partial<RawMaterial>).lastUpdated)}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Created At</p>
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                      {isNew ? fmtTs(new Date().toISOString()) : fmtTs((modal as Partial<RawMaterial>).createdAt)}
                    </p>
                  </div>
                </div>
              )}
              <div className="md:col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <><RefreshCw size={14} className="animate-spin"/>{isNew ? "Creating…" : "Saving…"}</> : isNew ? "Create Material" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Inward / Outward Modal ────────────────────────── */}
      {stockModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !stockResult) setStockModal(null); }}>
          <div className="modal-box w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                {stockModal.type === "inward"
                  ? <><ArrowDownCircle size={18} className="text-emerald-600"/> Inward — Receive Stock</>
                  : <><ArrowUpCircle   size={18} className="text-red-600"/>     Outward — Issue Stock</>}
              </h3>
              <button onClick={() => setStockModal(null)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={18}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <Package size={18} className="text-blue-600 shrink-0"/>
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">{stockModal.item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Stock: <strong>{stockModal.item.quantity} {stockModal.item.unit}</strong> · Min: <strong>{stockModal.item.minStock}</strong></p>
                </div>
                <StatusBadge status={stockModal.item.status} />
              </div>
              {stockResult ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5"/>
                    <p className="text-sm text-emerald-800 dark:text-emerald-300">{stockResult}</p>
                  </div>
                  <button onClick={() => setStockModal(null)} className="w-full btn-primary">Close</button>
                </div>
              ) : (
                <form onSubmit={handleStockAction} className="space-y-4">
                  <Field label={`Quantity to ${stockModal.type === "inward" ? "receive" : "issue"} *`}>
                    <input type="number" min={1} value={stockQty} required onChange={e => setStockQty(Number(e.target.value))} className="form-input"/>
                  </Field>
                  <Field label="Note (optional)">
                    <input value={stockNote} onChange={e => setStockNote(e.target.value)} className="form-input" placeholder="e.g. PO #1234, supplier batch…"/>
                  </Field>
                  {stockError && (
                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                      <AlertTriangle size={14} className="shrink-0"/>{stockError}
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button type="button" onClick={() => setStockModal(null)} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={stockSaving}
                      className={`btn font-semibold text-white gap-2 ${stockModal.type === "inward" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
                      {stockSaving ? <><Loader2 size={14} className="animate-spin"/> Processing…</> : stockModal.type === "inward" ? <><ArrowDownCircle size={14}/> Confirm Inward</> : <><ArrowUpCircle size={14}/> Confirm Outward</>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Excel Import Modal ────────────────────────────── */}
      {importState !== "idle" && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && importState !== "importing") resetImport(); }}>
          <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Upload size={18} className="text-violet-600"/> Import Raw Materials
              </h3>
              {importState !== "importing" && <button onClick={resetImport} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={18}/></button>}
            </div>

            <div className="p-6 space-y-4">
              {importState === "done" && importResult ? (
                <>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5"/>
                    <div className="text-sm text-emerald-800 dark:text-emerald-300">
                      <p className="font-bold">Import complete</p>
                      <p className="mt-0.5">Created: <strong>{importResult.created}</strong> · Skipped: <strong>{importResult.skipped}</strong></p>
                      {importResult.errors.length > 0 && (
                        <ul className="mt-2 text-xs text-red-600 dark:text-red-400 space-y-0.5">
                          {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>⚠ {e}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                  <button onClick={resetImport} className="w-full btn-primary">Done</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Preview — <strong>{importRows.length}</strong> row{importRows.length !== 1 ? "s" : ""} found.
                    Confirm to import into Raw Materials.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 max-h-64">
                    <table className="data-table text-xs">
                      <thead>
                        <tr>
                          {["Name","Category","Qty","Unit","Supplier","Min Stock","Price (₹)"].map(h => (
                            <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td>{String(row["Name"] || row["name"] || "")}</td>
                            <td>{String(row["Category"] || "")}</td>
                            <td>{String(row["Qty"] || row["quantity"] || 0)}</td>
                            <td>{String(row["Unit"] || "pcs")}</td>
                            <td>{String(row["Supplier"] || "—")}</td>
                            <td>{String(row["Min Stock"] || 0)}</td>
                            <td>₹{String(row["Price (₹)"] || 0)}</td>
                          </tr>
                        ))}
                        {importRows.length > 10 && (
                          <tr><td colSpan={7} className="text-center text-gray-400 py-2 text-xs">+{importRows.length - 10} more rows…</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button onClick={resetImport} className="btn-secondary">Cancel</button>
                    <button onClick={handleImportConfirm} disabled={importState === "importing"}
                      className="btn bg-violet-600 hover:bg-violet-700 text-white font-semibold gap-2">
                      {importState === "importing" ? <><Loader2 size={14} className="animate-spin"/> Importing…</> : <><Upload size={14}/> Import {importRows.length} Items</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
