"use client";
export const dynamic = "force-dynamic";
// app/finished-products/page.tsx — Full CRUD + Inward/Outward/Manufacture + Excel Import + BOM in modal
import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/AppShell";
import {
  getFinishedProducts, createFinishedProduct,
  updateFinishedProduct, deleteFinishedProduct,
  inwardStock, outwardStock, produceProduct,
  getBom, getFeasibility, setBom as saveBom,
  getRawMaterials, importFinishedProducts,
} from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { FinishedProduct, BomEntry, FeasibilityMaterial, RawMaterial } from "@/types";
import {
  Search, Plus, X, FileSpreadsheet, FileText, Download,
  Pencil, Trash2, Box, RefreshCw, AlertTriangle, MapPin,
  Truck, BarChart2, ChevronDown, ChevronUp,
  ArrowDownCircle, ArrowUpCircle, Factory,
  CheckCircle2, XCircle, Loader2, Upload,
  TableProperties, GitBranch, AlertCircle,
} from "lucide-react";

// ── export helpers ─────────────────────────────────────────────
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
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
  const ws   = XLSX.utils.aoa_to_sheet([[BRAND], []]);
  XLSX.utils.sheet_add_json(ws, rows, { origin: -1 });
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), file);
}
function pdfExport(token: string) {
  fetch("/api/finished-products/export/pdf", { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (!r.ok) throw new Error("PDF failed"); return r.blob(); })
    .then(blob => downloadBlob(blob, "finished-products.pdf"))
    .catch(console.error);
}

async function downloadImportTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    [BRAND], [],
    ["Name","Qty","Unit","Category","Location","Supplier","Min Stock","Price (₹)"],
    ["Iotzee",16,"Box","Finished Products","Warehouse A","S2R2 Production",5,4500],
    ["Display Stand",9,"Box","Finished Products","Warehouse B","S2R2 Production",10,1800],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Finished Products");
  downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "finished-products-import-template.xlsx");
}

// ── sub-components ─────────────────────────────────────────────
function StockBadge({ s }: { s: FinishedProduct["stockStatus"] }) {
  if (s === "out") return <span className="badge-red">Out of Stock</span>;
  if (s === "low") return <span className="badge-amber">Low Stock</span>;
  return <span className="badge-green">In Stock</span>;
}
function StatusBadge({ status }: { status: FinishedProduct["status"] }) {
  return status === "ACTIVE"
    ? <span className="badge-green">Active</span>
    : <span className="badge-amber">Hold</span>;
}
function StockBar({ qty, minStock, maxQty }: { qty: number; minStock: number; maxQty: number }) {
  const pct   = maxQty > 0 ? Math.min(100, (qty / maxQty) * 100) : 0;
  const color = qty === 0 ? "bg-red-500" : minStock > 0 && qty <= minStock ? "bg-amber-400" : "bg-emerald-500";
  return (
    <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
const EMPTY: Omit<FinishedProduct, "id" | "stockStatus" | "createdAt" | "updatedAt"> = {
  name: "", qty: 0, unit: "Box", category: "Finished Products",
  location: null, supplier: null, minStock: 0, price: 0, status: "ACTIVE",
};
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

// ── action modal types ─────────────────────────────────────────
type ActionModal =
  | { type: "inward";    product: FinishedProduct }
  | { type: "outward";   product: FinishedProduct }
  | { type: "manufacture"; product: FinishedProduct };

export default function FinishedProductsPage() {
  const { canAdd, canEdit, canDelete, isAdmin } = usePermissions("finished-product");
  const [products,     setProducts]     = useState<FinishedProduct[]>([]);
  const [filtered,     setFiltered]     = useState<FinishedProduct[]>([]);
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stockFilter,  setStockFilter]  = useState("");
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [view,         setView]         = useState<"grid" | "table">(
    () => (typeof window !== "undefined" ? localStorage.getItem("s2r2_view_mode") as "grid" | "table" : null) || "grid"
  );
  const [modal,        setModal]        = useState<Partial<FinishedProduct> | null>(null);
  const [isNew,        setIsNew]        = useState(false);

  // ── action modal state ──────────────────────────────────────
  const [actionModal,  setActionModal]  = useState<ActionModal | null>(null);
  const [actionQty,    setActionQty]    = useState(1);
  const [actionNote,   setActionNote]   = useState("");
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError,  setActionError]  = useState("");
  const [actionResult, setActionResult] = useState<string | null>(null);

  // ── BOM / feasibility state (manufacture modal) ─────────────
  const [bom,           setBom]          = useState<BomEntry[]>([]);
  const [feasibility,   setFeasibility]  = useState<FeasibilityMaterial[]>([]);
  const [feasible,      setFeasible]     = useState<boolean | null>(null);
  const [bomLoading,    setBomLoading]   = useState(false);

  // ── BOM editor state (CRUD modal) ───────────────────────────
  const [rawMats,       setRawMats]      = useState<RawMaterial[]>([]);
  const [editBomEntries, setEditBomEntries] = useState<{ rawMaterialId: number; quantityRequired: number }[]>([]);
  const [bomSaving,     setBomSaving]    = useState(false);

  // ── Excel import state ───────────────────────────────────────
  type ImportState = "idle" | "preview" | "importing" | "done";
  type ImportRow = Record<string, unknown>;
  const [importState,  setImportState]  = useState<ImportState>("idle");
  const [importRows,   setImportRows]   = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [importError,  setImportError]  = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── sort ────────────────────────────────────────────────────
  const [sortCol, setSortCol] = useState<keyof FinishedProduct>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  function toggleSort(col: keyof FinishedProduct) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }
  function SortIcon({ col }: { col: keyof FinishedProduct }) {
    if (sortCol !== col) return <ChevronDown size={10} className="opacity-30" />;
    return sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  }
  const TH = ({ col, label }: { col: keyof FinishedProduct; label: string }) => (
    <th onClick={() => toggleSort(col)}
      className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-blue-600 dark:hover:text-blue-400">
      <span className="inline-flex items-center gap-1">{label}<SortIcon col={col} /></span>
    </th>
  );

  const token = typeof window !== "undefined" ? localStorage.getItem("s2r2_token") || "" : "";

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try { const { products } = await getFinishedProducts(); setProducts(products); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    let result = products.filter(p => {
      const q = search.toLowerCase();
      const matchText  = !q || `${p.name} ${p.unit} ${p.category} ${p.location ?? ""} ${p.supplier ?? ""}`.toLowerCase().includes(q);
      const matchStat  = !statusFilter || p.status === statusFilter;
      const matchStock = !stockFilter  || p.stockStatus === stockFilter;
      return matchText && matchStat && matchStock;
    });
    result = [...result].sort((a, b) => {
      const cmp = String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
    setFiltered(result);
  }, [products, search, statusFilter, stockFilter, sortCol, sortDir]);

  function openAdd() {
    setIsNew(true);
    setModal({ ...EMPTY });
    setEditBomEntries([]);
    // Pre-load raw materials for BOM editor
    getRawMaterials().then(({ items }) => setRawMats(items)).catch(() => {});
  }
  function openEdit(p: FinishedProduct) {
    setIsNew(false);
    setModal({ ...p });
    setEditBomEntries([]);
    // Pre-load BOM entries + raw materials
    getRawMaterials().then(({ items }) => setRawMats(items)).catch(() => {});
    getBom(p.id).then(b => setEditBomEntries(b.entries.map(e => ({
      rawMaterialId: e.rawMaterialId, quantityRequired: e.quantityRequired,
    })))).catch(() => {});
  }
  function closeModal() { setModal(null); setEditBomEntries([]); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    try {
      let savedId = modal.id;
      if (isNew) {
        const res = await createFinishedProduct(modal) as FinishedProduct;
        savedId = res.id;
      } else {
        await updateFinishedProduct(modal.id!, modal);
      }
      // Save BOM entries if any were defined
      if (savedId && editBomEntries.length > 0) {
        setBomSaving(true);
        await saveBom(savedId, editBomEntries).catch(() => {});
        setBomSaving(false);
      }
      closeModal();
      fetchProducts();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    await deleteFinishedProduct(id); fetchProducts();
  }

  // ── open action modals ──────────────────────────────────────
  function openAction(type: ActionModal["type"], product: FinishedProduct) {
    setActionModal({ type, product } as ActionModal);
    setActionQty(1);
    setActionNote("");
    setActionError("");
    setActionResult(null);
    setBom([]);
    setFeasibility([]);
    setFeasible(null);

    if (type === "manufacture") {
      setBomLoading(true);
      Promise.all([
        getBom(product.id),
        getFeasibility(product.id, 1),
      ]).then(([bomData, feasData]) => {
        setBom(bomData.entries);
        setFeasibility(feasData.materials);
        setFeasible(feasData.feasible);
      }).catch(console.error)
        .finally(() => setBomLoading(false));
    }
  }

  async function refreshFeasibility(qty: number, productId: number) {
    if (!qty || qty < 1) return;
    try {
      const f = await getFeasibility(productId, qty);
      setFeasibility(f.materials);
      setFeasible(f.feasible);
    } catch { /* silent */ }
  }

  async function handleAction(e: React.FormEvent) {
    e.preventDefault();
    if (!actionModal) return;
    setActionError("");
    setActionSaving(true);
    try {
      const { type, product } = actionModal;
      if (type === "inward") {
        await inwardStock({ itemType: "FINISHED_PRODUCT", itemId: product.id, quantity: actionQty, note: actionNote });
        setActionResult(`✅ Added ${actionQty} unit(s) of ${product.name} to stock.`);
      } else if (type === "outward") {
        await outwardStock({ itemId: product.id, quantity: actionQty, note: actionNote });
        setActionResult(`✅ Dispatched ${actionQty} unit(s) of ${product.name}.`);
      } else if (type === "manufacture") {
        const res = await produceProduct({ finishedProductId: product.id, quantity: actionQty, note: actionNote });
        let msg = res.message;
        if (res.lowStockAlerts?.length) {
          msg += ` ⚠️ Low stock: ${res.lowStockAlerts.map(a => a.name).join(", ")}`;
        }
        setActionResult(msg);
      }
      fetchProducts();
    } catch (err: unknown) {
      setActionError((err as Error).message || "Operation failed");
    } finally {
      setActionSaving(false);
    }
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
      const data = raw.filter(r => String(r["Name"] || r["name"] || "").trim());
      if (!data.length) { setImportError("No valid rows found. Check column headers match the template."); return; }
      setImportRows(data); setImportState("preview");
    } catch { setImportError("Could not read file. Please use the Excel template."); }
    if (fileRef.current) fileRef.current.value = "";
  }
  async function handleImportConfirm() {
    setImportState("importing");
    try {
      const result = await importFinishedProducts(importRows);
      setImportResult(result); setImportState("done"); fetchProducts();
    } catch (err: unknown) {
      setImportError((err as Error).message || "Import failed"); setImportState("preview");
    }
  }
  function resetImport() { setImportState("idle"); setImportRows([]); setImportResult(null); setImportError(""); }

  // ── rows for export ─────────────────────────────────────────
  const rows = () => filtered.map(p => ({
    ID: p.id, Name: p.name, Qty: p.qty, Unit: p.unit,
    Category: p.category, Location: p.location ?? "",
    Supplier: p.supplier ?? "", "Min Stock": p.minStock,
    "Price (₹)": p.price, "Stock Value (₹)": p.qty * p.price,
    Status: p.status, "Stock Status": p.stockStatus,
    "Created At":  fmtTs(p.createdAt),
    "Updated At":  fmtTs(p.updatedAt),
  }));

  function exportCsv() {
    import("papaparse").then(({ default: Papa }) => {
      const csv = BRAND + "\n\n" + Papa.unparse(rows());
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "finished-products.csv");
    });
  }

  // ── summary ─────────────────────────────────────────────────
  const lowItems  = products.filter(p => p.stockStatus === "low");
  const outItems  = products.filter(p => p.stockStatus === "out");
  const totalQty  = products.reduce((s, p) => s + p.qty, 0);
  const stockValue = products.reduce((s, p) => s + p.qty * (p.price ?? 0), 0);
  const maxQty    = Math.max(...filtered.map(p => p.qty), 1);

  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl mx-auto">

        {/* ── Page header ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Box size={22} className="text-emerald-600" /> Finished Products
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">Manage finished inventory — add, edit, delete, export</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            {canAdd && (
              <>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect}/>
                <button onClick={downloadImportTemplate}
                  className="btn btn-sm bg-gray-600 text-white hover:bg-gray-700 gap-1.5 px-3 py-2 text-sm">
                  <TableProperties size={14}/> Template
                </button>
                <button onClick={() => { setImportError(""); fileRef.current?.click(); }}
                  className="btn bg-violet-600 text-white hover:bg-violet-700 gap-1.5 px-4 py-2 text-sm font-semibold">
                  <Upload size={15}/> Import Excel
                </button>
                <button onClick={openAdd} className="btn-success gap-2 px-4 py-2 text-sm">
                  <Plus size={15} /> Add Product
                </button>
              </>
            )}
            {!canAdd && (
              <button onClick={openAdd} className="btn-success self-start gap-2">
                <Plus size={16} /> Add Product
              </button>
            )}
          </div>
        </div>

        {/* ── Stock alerts ────────────────────────────── */}
        {outItems.length > 0 && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={18} />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400 text-sm">
                  {outItems.length} product{outItems.length > 1 ? "s" : ""} out of stock
                </p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1 flex flex-wrap gap-1">
                  {outItems.map(p => <span key={p.id} className="bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-full">{p.name}</span>)}
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
                  {lowItems.length} product{lowItems.length > 1 ? "s" : ""} running low
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1 flex flex-wrap gap-1">
                  {lowItems.map(p => <span key={p.id} className="bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">{p.name} ({p.qty}/{p.minStock})</span>)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Summary chips ────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Products",    value: products.length,                                        cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
            { label: "Total Qty",   value: totalQty,                                               cls: "bg-blue-50   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300"    },
            { label: "In Stock",    value: products.filter(p => p.stockStatus === "active").length, cls: "bg-green-50  text-green-700  dark:bg-green-900/30  dark:text-green-300"   },
            { label: "Low Stock",   value: lowItems.length,                                        cls: "bg-amber-50  text-amber-700  dark:bg-amber-900/30  dark:text-amber-300"   },
            { label: "Out",         value: outItems.length,                                        cls: "bg-red-50    text-red-700    dark:bg-red-900/30    dark:text-red-300"     },
            { label: "Stock Value", value: `₹${stockValue.toLocaleString("en-IN")}`,               cls: "bg-blue-50   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300"    },
          ].map(s => (
            <div key={s.label} className={`px-4 py-2 rounded-xl text-sm font-semibold ${s.cls}`}>
              {s.label}: <strong>{s.value}</strong>
            </div>
          ))}
        </div>

        {/* ── Toolbar ─────────────────────────────────── */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, location, supplier…" className="form-input pl-9" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select w-36">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="HOLD">Hold</option>
            </select>
            <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="form-select w-40">
              <option value="">All Stock</option>
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
                  className={`px-3 py-2 text-xs font-semibold transition capitalize ${view === v ? "bg-emerald-600 text-white" : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50"}`}>
                  {v}
                </button>
              ))}
            </div>
            <button onClick={fetchProducts} className="btn-secondary btn-sm">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={exportCsv} className="btn btn-sm bg-sky-600 text-white hover:bg-sky-700 gap-1"><FileText size={12}/>CSV</button>
            <button onClick={() => xlsxExport(rows(), "Finished Products", "finished-products.xlsx")}
              className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 gap-1"><FileSpreadsheet size={12}/>Excel</button>
            <button onClick={() => pdfExport(token)} className="btn btn-sm bg-red-600 text-white hover:bg-red-700 gap-1"><Download size={12}/>PDF</button>
            {(search || statusFilter || stockFilter) && (
              <button onClick={() => { setSearch(""); setStatusFilter(""); setStockFilter(""); }} className="btn-secondary btn-sm">
                <X size={12}/> Reset
              </button>
            )}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────── */}
        {loading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card h-52 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card py-20 text-center text-gray-400">
            <Box size={56} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No products found</p>
            {canAdd && <p className="text-sm mt-1"><button onClick={openAdd} className="text-emerald-600 hover:underline">Add the first product</button></p>}
          </div>
        ) : view === "grid" ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => (
              <div key={p.id} className="card p-5 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="font-bold text-gray-800 dark:text-white truncate">{p.name}</h3>
                    <span className="text-xs text-gray-400 mt-0.5">FP-{p.id} · {p.category}</span>
                  </div>
                  <StockBadge s={p.stockStatus} />
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Quantity</p>
                    <p className={`font-bold ${p.stockStatus === "out" ? "text-red-600" : p.stockStatus === "low" ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}`}>
                      {p.qty} {p.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Min Stock</p>
                    <p className="font-semibold text-gray-700 dark:text-gray-300">{p.minStock} {p.unit}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Unit Price</p>
                    <p className="font-bold text-blue-600 dark:text-blue-400">₹{(p.price ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Stock Value</p>
                    <p className="font-bold text-gray-800 dark:text-gray-100">₹{(p.qty * (p.price ?? 0)).toLocaleString("en-IN")}</p>
                  </div>
                </div>

                {(p.location || p.supplier) && (
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {p.location && <span className="flex items-center gap-1"><MapPin size={10}/>{p.location}</span>}
                    {p.supplier && <span className="flex items-center gap-1"><Truck size={10}/>{p.supplier}</span>}
                  </div>
                )}

                <StockBar qty={p.qty} minStock={p.minStock ?? 0} maxQty={maxQty} />
                <p className="text-[10px] text-gray-400 font-mono mt-1">Updated: {fmtTs(p.updatedAt)}</p>

                {/* ── Action row ── */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {canEdit && (
                    <>
                      <button onClick={() => openAction("inward", p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-semibold transition">
                        <ArrowDownCircle size={12}/> Inward
                      </button>
                      <button onClick={() => openAction("outward", p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 text-xs font-semibold transition">
                        <ArrowUpCircle size={12}/> Outward
                      </button>
                      <button onClick={() => openAction("manufacture", p)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-semibold transition">
                        <Factory size={12}/> Manufacture
                      </button>
                    </>
                  )}
                  <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition" title="Edit"><Pencil size={12}/></button>}
                    {canDelete && <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition" title="Delete"><Trash2 size={12}/></button>}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <StatusBadge status={p.status} />
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
                    <TH col="id"          label="ID"        />
                    <TH col="name"        label="Name"      />
                    <TH col="qty"         label="Qty"       />
                    <TH col="unit"        label="Unit"      />
                    <TH col="category"    label="Category"  />
                    <TH col="minStock"    label="Min Stock" />
                    <TH col="price"       label="Price"     />
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Stock Value</th>
                    <TH col="stockStatus" label="Stock"     />
                    <TH col="status"      label="Status"    />
                    <TH col="createdAt"   label="Created At"  />
                    <TH col="updatedAt"   label="Updated At"  />
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id}>
                      <td className="text-gray-400">{p.id}</td>
                      <td className="font-semibold text-gray-800 dark:text-white">{p.name}</td>
                      <td className={`font-bold ${p.stockStatus==="out" ? "text-red-600" : p.stockStatus==="low" ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}`}>{p.qty}</td>
                      <td>{p.unit}</td>
                      <td><span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{p.category}</span></td>
                      <td>{p.minStock}</td>
                      <td className="font-semibold text-blue-600 dark:text-blue-400">₹{(p.price??0).toLocaleString("en-IN")}</td>
                      <td className="font-semibold">₹{(p.qty*(p.price??0)).toLocaleString("en-IN")}</td>
                      <td><StockBadge s={p.stockStatus} /></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">{fmtTs(p.createdAt)}</td>
                      <td className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">{fmtTs(p.updatedAt)}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          {canEdit && <>
                            <button onClick={() => openAction("inward", p)}    title="Inward"      className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-100 transition"><ArrowDownCircle size={13}/></button>
                            <button onClick={() => openAction("outward", p)}   title="Outward"     className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition"><ArrowUpCircle size={13}/></button>
                            <button onClick={() => openAction("manufacture", p)} title="Manufacture" className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition"><Factory size={13}/></button>
                            <button onClick={() => openEdit(p)}                title="Edit"        className="p-1.5 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 hover:bg-gray-100 transition"><Pencil size={13}/></button>
                          </>}
                          {canDelete && <button onClick={() => handleDelete(p.id, p.name)} title="Delete" className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition"><Trash2 size={13}/></button>}
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

      {/* ═══════════════════════════════════════════════════════
          CRUD MODAL (add / edit)
      ═══════════════════════════════════════════════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-box w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
            {/* ── Modal header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <BarChart2 size={18} className="text-emerald-600" />
                {isNew ? "Add Finished Product" : "Edit Product"}
              </h3>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={18}/></button>
            </div>

            {/* ── Two-column body: LEFT = fields, RIGHT = BOM ── */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

              {/* LEFT — product details */}
              <form onSubmit={handleSave} className="flex flex-col w-full md:w-[52%] border-r border-gray-100 dark:border-gray-700 overflow-y-auto">
                <div className="p-5 space-y-3 flex-1">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Product Details</p>
                  <Field label="Name *">
                    <input value={modal.name ?? ""} onChange={e => setModal({ ...modal, name: e.target.value })} required className="form-input" placeholder="e.g. Iotzee" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Quantity *">
                      <input type="number" min={0} value={modal.qty ?? 0} onChange={e => setModal({ ...modal, qty: Number(e.target.value) })} required className="form-input" />
                    </Field>
                    <Field label="Unit *">
                      <input list="fp-units" value={modal.unit ?? ""} onChange={e => setModal({ ...modal, unit: e.target.value })} required className="form-input" placeholder="Box, pcs…" />
                      <datalist id="fp-units"><option value="Box"/><option value="pcs"/><option value="Complete"/><option value="Set"/></datalist>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Min Stock">
                      <input type="number" min={0} value={modal.minStock ?? 0} onChange={e => setModal({ ...modal, minStock: Number(e.target.value) })} className="form-input" />
                    </Field>
                    <Field label="Unit Price (₹)">
                      <input type="number" min={0} step="any" value={modal.price ?? 0} onChange={e => setModal({ ...modal, price: Number(e.target.value) })} className="form-input" />
                    </Field>
                  </div>
                  <Field label="Category">
                    <input value={modal.category ?? ""} onChange={e => setModal({ ...modal, category: e.target.value })} className="form-input" placeholder="Finished Products" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Location">
                      <input list="fp-locations" value={modal.location ?? ""} onChange={e => setModal({ ...modal, location: e.target.value || null })} className="form-input" placeholder="Warehouse A" />
                      <datalist id="fp-locations"><option value="Warehouse A"/><option value="Warehouse B"/><option value="Production"/></datalist>
                    </Field>
                    <Field label="Supplier">
                      <input value={modal.supplier ?? ""} onChange={e => setModal({ ...modal, supplier: e.target.value || null })} className="form-input" placeholder="S2R2 Production" />
                    </Field>
                  </div>
                  <Field label="Status">
                    <select value={modal.status ?? "ACTIVE"} onChange={e => setModal({ ...modal, status: e.target.value as FinishedProduct["status"] })} className="form-select">
                      <option value="ACTIVE">Active</option>
                      <option value="HOLD">Hold</option>
                    </select>
                  </Field>
                  {/* Timestamps — editable for ADMIN, read-only for others */}
                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">
                        Updated At {isAdmin && !isNew && <span className="text-blue-500 normal-case">(editable)</span>}
                      </p>
                      {isAdmin && !isNew ? (
                        <input
                          type="datetime-local"
                          className="form-input text-xs font-mono"
                          value={toDatetimeLocal((modal as Partial<FinishedProduct>).updatedAt)}
                          onChange={e => setModal({ ...modal, updatedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined } as Partial<FinishedProduct>)}
                        />
                      ) : (
                        <p className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                          {isNew ? fmtTs(new Date().toISOString()) : fmtTs((modal as Partial<FinishedProduct>).updatedAt)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Created At</p>
                      <p className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                        {isNew ? fmtTs(new Date().toISOString()) : fmtTs((modal as Partial<FinishedProduct>).createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
                  <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={saving || bomSaving} className="btn-success">
                    {(saving || bomSaving) ? <><Loader2 size={14} className="animate-spin"/>{isNew ? "Creating…" : "Saving…"}</> : isNew ? "Create Product" : "Save Changes"}
                  </button>
                </div>
              </form>

              {/* RIGHT — BOM editor */}
              <div className="flex flex-col w-full md:w-[48%] overflow-hidden">
                {/* BOM header */}
                <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch size={15} className="text-blue-500"/>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Bill of Materials</p>
                    </div>
                    <button type="button"
                      onClick={() => setEditBomEntries(prev => [...prev, { rawMaterialId: rawMats[0]?.id ?? 0, quantityRequired: 1 }])}
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-lg transition">
                      <Plus size={12}/> Add
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Components needed to manufacture 1 unit
                  </p>
                </div>

                {/* BOM entries list */}
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {editBomEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
                      <GitBranch size={32} className="text-gray-300 dark:text-gray-600"/>
                      <p className="text-sm text-gray-400 dark:text-gray-500">No components defined</p>
                      <button type="button"
                        onClick={() => setEditBomEntries([{ rawMaterialId: rawMats[0]?.id ?? 0, quantityRequired: 1 }])}
                        className="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white gap-1.5 font-semibold">
                        <Plus size={13}/> Add first component
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {editBomEntries.map((entry, idx) => {
                        const rm = rawMats.find(r => r.id === entry.rawMaterialId);
                        return (
                          <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx+1}
                            </span>
                            <select value={entry.rawMaterialId}
                              onChange={e => setEditBomEntries(prev => prev.map((b, i) => i === idx ? { ...b, rawMaterialId: Number(e.target.value) } : b))}
                              className="form-select flex-1 text-xs min-w-0">
                              {rawMats.map(r => <option key={r.id} value={r.id}>{r.name} ({r.quantity} {r.unit})</option>)}
                            </select>
                            <input type="number" min={0.1} step="any" value={entry.quantityRequired}
                              onChange={e => setEditBomEntries(prev => prev.map((b, i) => i === idx ? { ...b, quantityRequired: Number(e.target.value) } : b))}
                              className="form-input w-14 text-center text-xs px-1.5 shrink-0"/>
                            <span className="text-[11px] text-gray-400 shrink-0 w-7">{rm?.unit ?? "pcs"}</span>
                            <button type="button"
                              onClick={() => setEditBomEntries(prev => prev.filter((_, i) => i !== idx))}
                              className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 transition shrink-0">
                              <Trash2 size={12}/>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* BOM cost footer */}
                {editBomEntries.length > 0 && (
                  <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800/40">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {editBomEntries.length} component{editBomEntries.length !== 1 ? "s" : ""} · material cost/unit
                      </span>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        ₹{editBomEntries.reduce((sum, e) => {
                          const rm = rawMats.find(r => r.id === e.rawMaterialId);
                          return sum + (rm?.price ?? 0) * e.quantityRequired;
                        }, 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ═══════════════════════════════════════════════════════
          ACTION MODALS — INWARD / OUTWARD / MANUFACTURE
      ═══════════════════════════════════════════════════════ */}
      {actionModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !actionResult) setActionModal(null); }}>
          <div className="modal-box w-full max-w-lg">

            {/* Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700`}>
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                {actionModal.type === "inward"      && <><ArrowDownCircle size={18} className="text-emerald-600"/> Inward Stock</>}
                {actionModal.type === "outward"     && <><ArrowUpCircle   size={18} className="text-red-600"/>     Outward Dispatch</>}
                {actionModal.type === "manufacture" && <><Factory         size={18} className="text-blue-600"/>    Manufacture</>}
              </h3>
              <button onClick={() => setActionModal(null)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={18}/></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Product info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                <Box size={18} className="text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white text-sm">{actionModal.product.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Current stock: <strong>{actionModal.product.qty} {actionModal.product.unit}</strong>
                  </p>
                </div>
                <StockBadge s={actionModal.product.stockStatus} />
              </div>

              {/* Success result */}
              {actionResult ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-800 dark:text-emerald-300">{actionResult}</p>
                  </div>
                  <button onClick={() => setActionModal(null)} className="w-full btn-success">Close</button>
                </div>
              ) : (
                <form onSubmit={handleAction} className="space-y-4">

                  {/* BOM breakdown for manufacture */}
                  {actionModal.type === "manufacture" && (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bill of Materials</p>
                      {bomLoading ? (
                        <div className="flex items-center gap-2 text-sm text-gray-400 py-4 justify-center">
                          <Loader2 size={16} className="animate-spin" /> Loading BOM…
                        </div>
                      ) : bom.length === 0 ? (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
                          <AlertTriangle size={15} className="shrink-0" />
                          No BOM defined for this product. Add BOM entries to enable manufacture.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {feasibility.map((m, i) => (
                            <div key={i} className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                              m.sufficient ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                                           : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"}`}>
                              <div className="flex items-center gap-2">
                                {m.sufficient
                                  ? <CheckCircle2 size={13} className="text-emerald-600 shrink-0"/>
                                  : <XCircle      size={13} className="text-red-600 shrink-0"/>}
                                <span className="font-medium text-gray-800 dark:text-white">{m.name}</span>
                              </div>
                              <div className="text-right text-gray-500 dark:text-gray-400">
                                <span className={m.sufficient ? "text-emerald-600" : "text-red-600"}>
                                  Need: {m.required} {m.unit}
                                </span>
                                <span className="mx-1">·</span>
                                Have: {m.available} {m.unit}
                                {!m.sufficient && <span className="ml-1 text-red-600 font-bold">(short {m.shortfall})</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quantity input */}
                  <Field label={`Quantity to ${actionModal.type === "inward" ? "receive" : actionModal.type === "outward" ? "dispatch" : "produce"} *`}>
                    <input
                      type="number" min={1} value={actionQty} required
                      onChange={e => {
                        const v = Number(e.target.value);
                        setActionQty(v);
                        if (actionModal.type === "manufacture" && v > 0) {
                          refreshFeasibility(v, actionModal.product.id);
                        }
                      }}
                      className="form-input"
                    />
                  </Field>

                  {/* Note */}
                  <Field label="Note (optional)">
                    <input value={actionNote} onChange={e => setActionNote(e.target.value)}
                      className="form-input" placeholder="e.g. Client order, batch ref…" />
                  </Field>

                  {/* Feasibility indicator for manufacture */}
                  {actionModal.type === "manufacture" && bom.length > 0 && feasible !== null && (
                    <div className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold ${
                      feasible
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 text-emerald-800 dark:text-emerald-300"
                        : "bg-red-50 dark:bg-red-900/20 border-red-200 text-red-800 dark:text-red-300"}`}>
                      {feasible ? <CheckCircle2 size={16} className="text-emerald-600"/> : <XCircle size={16} className="text-red-600"/>}
                      {feasible ? `✅ Sufficient materials to produce ${actionQty} unit(s)` : `❌ Insufficient materials for ${actionQty} unit(s)`}
                    </div>
                  )}

                  {/* Error */}
                  {actionError && (
                    <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                      <AlertTriangle size={14} className="shrink-0" />{actionError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button type="button" onClick={() => setActionModal(null)} className="btn-secondary">Cancel</button>
                    <button type="submit" disabled={actionSaving || (actionModal.type === "manufacture" && bom.length === 0)}
                      className={`btn font-semibold text-white gap-2 ${
                        actionModal.type === "inward"      ? "bg-emerald-600 hover:bg-emerald-700"
                        : actionModal.type === "outward"   ? "bg-red-600 hover:bg-red-700"
                        : "bg-blue-600 hover:bg-blue-700"}`}>
                      {actionSaving ? <><Loader2 size={14} className="animate-spin"/> Processing…</> : (
                        <>
                          {actionModal.type === "inward"      && <><ArrowDownCircle size={14}/> Confirm Inward</>}
                          {actionModal.type === "outward"     && <><ArrowUpCircle   size={14}/> Confirm Dispatch</>}
                          {actionModal.type === "manufacture" && <><Factory         size={14}/> Manufacture {actionQty} Unit(s)</>}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ═══ EXCEL IMPORT MODAL ═══════════════════════════════ */}
      {importState !== "idle" && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && importState !== "importing") resetImport(); }}>
          <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Upload size={18} className="text-violet-600"/> Import Finished Products
              </h3>
              {importState !== "importing" && <button onClick={resetImport} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><X size={18}/></button>}
            </div>
            <div className="p-6 space-y-4">
              {importError && (
                <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                  <AlertCircle size={14} className="shrink-0"/>{importError}
                </div>
              )}
              {importState === "done" && importResult ? (
                <>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5"/>
                    <div className="text-sm text-emerald-800 dark:text-emerald-300">
                      <p className="font-bold">Import complete</p>
                      <p className="mt-0.5">Created: <strong>{importResult.created}</strong> · Skipped: <strong>{importResult.skipped}</strong></p>
                      {importResult.errors.length > 0 && (
                        <ul className="mt-2 text-xs text-red-600 dark:text-red-400 space-y-0.5">
                          {importResult.errors.slice(0,5).map((e,i) => <li key={i}>⚠ {e}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                  <button onClick={resetImport} className="w-full btn-success">Done</button>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Preview — <strong>{importRows.length}</strong> row{importRows.length !== 1 ? "s" : ""} found. Confirm to import.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 max-h-64">
                    <table className="data-table text-xs">
                      <thead>
                        <tr>{["Name","Qty","Unit","Category","Min Stock","Price (₹)"].map(h => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0,10).map((row,i) => (
                          <tr key={i}>
                            <td>{String(row["Name"]||row["name"]||"")}</td>
                            <td>{String(row["Qty"]||row["qty"]||0)}</td>
                            <td>{String(row["Unit"]||"Box")}</td>
                            <td>{String(row["Category"]||"Finished Products")}</td>
                            <td>{String(row["Min Stock"]||0)}</td>
                            <td>₹{String(row["Price (₹)"]||0)}</td>
                          </tr>
                        ))}
                        {importRows.length > 10 && <tr><td colSpan={6} className="text-center text-gray-400 py-2 text-xs">+{importRows.length-10} more…</td></tr>}
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
