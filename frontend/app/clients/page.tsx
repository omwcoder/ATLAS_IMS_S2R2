"use client";
export const dynamic = "force-dynamic";

// app/clients/page.tsx — Full CRUD + Excel Import + CSV / Excel / PDF Export
import { useEffect, useState, useCallback, useRef } from "react";
import AppShell from "@/components/AppShell";
import { getClients, createClient, updateClient, deleteClient, importClients } from "@/lib/api";
import { usePermissions } from "@/lib/permissions";
import { Client } from "@/types";
import {
  Search, X, UserPlus, Users, Pencil, Trash2,
  FileText, FileSpreadsheet, Download, Phone,
  Mail, MapPin, RefreshCw, Building2, Upload,
  CheckCircle2, AlertCircle, TableProperties,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────
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

// ─── export helpers ────────────────────────────────────────────
const BRAND = "Generated using Civi API | By Civitas Atlas Co, Pune";

function clientRows(list: Client[]) {
  return list.map(c => ({
    ID: c.id, "Client Name": c.clientName, Company: c.companyName ?? "",
    Phone: c.phone ?? "", Email: c.email ?? "", Address: c.address ?? "",
    "GST No": c.gstNo ?? "", Status: c.status,
    "Created At": fmtTs(c.createdAt),
    "Updated At": fmtTs(c.updatedAt),
  }));
}
function exportCsv(list: Client[]) {
  import("papaparse").then(({ default: Papa }) => {
    // branding line + blank line + data
    const csv = BRAND + "\n\n" + Papa.unparse(clientRows(list));
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), "clients.csv");
  });
}
async function exportXlsx(list: Client[]) {
  const XLSX = await import("xlsx");
  // branding row at top, blank separator, then data
  const ws = XLSX.utils.aoa_to_sheet([[BRAND], []]);
  XLSX.utils.sheet_add_json(ws, clientRows(list), { origin: -1 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }), "clients.xlsx");
}
function exportPdf() {
  const token = typeof window !== "undefined" ? localStorage.getItem("s2r2_token") || "" : "";
  fetch("/api/clients/export/pdf", { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (!r.ok) throw new Error("PDF failed"); return r.blob(); })
    .then(blob => downloadBlob(blob, "clients.pdf")).catch(console.error);
}

// ─── download template for import ─────────────────────────────
async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([
    [BRAND],
    [],
    ["Client Name","Company","Phone","Email","Address","GST No"],
    ["Tata Motors","Tata Motors Ltd","9876543210","contact@tata.com","Pune, MH","27AAACT2727Q1ZW"],
    ["Sample Client","Sample Co","9000000000","sample@email.com","Mumbai, MH",""],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  downloadBlob(new Blob([XLSX.write(wb, { type: "array", bookType: "xlsx" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }), "client-import-template.xlsx");
}

// ─── status badge ──────────────────────────────────────────────
function StatusBadge({ status }: { status: Client["status"] }) {
  return status === "ACTIVE"
    ? <span className="badge-green">Active</span>
    : <span className="badge-gray">Inactive</span>;
}

// ─── form field wrapper ────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── types ─────────────────────────────────────────────────────
type ImportRow = { "Client Name": string; Company?: string; Phone?: string; Email?: string; Address?: string; "GST No"?: string; [k: string]: string | undefined };
type ImportState = "idle" | "preview" | "importing" | "done";

const EMPTY: Omit<Client, "id" | "createdAt" | "updatedAt"> = {
  clientName: "", companyName: "", phone: "", email: "", address: "", gstNo: "", status: "ACTIVE",
};

export default function ClientsPage() {
  const { canAdd, canEdit, canDelete } = usePermissions("client");
  const isAdmin = typeof window !== "undefined" && localStorage.getItem("s2r2_role") === "ADMIN";
  // ─── list state ────────────────────────────────────────────
  const [clients,  setClients]  = useState<Client[]>([]);
  const [filtered, setFiltered] = useState<Client[]>([]);
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [view,     setView]     = useState<"grid"|"table">(
    () => (typeof window !== "undefined" ? localStorage.getItem("s2r2_view_mode") as "grid" | "table" : null) || "grid"
  );

  // ─── add / edit modal ─────────────────────────────────────
  const [modal, setModal] = useState<Partial<Client> | null>(null);
  const [isNew, setIsNew] = useState(false);

  // ─── import state ─────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importState,  setImportState]  = useState<ImportState>("idle");
  const [importRows,   setImportRows]   = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [importError,  setImportError]  = useState("");

  // ─── data fetching ─────────────────────────────────────────
  const fetchClients = useCallback(async () => {
    setLoading(true);
    try { const { clients } = await getClients(); setClients(clients); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(clients.filter(c => {
      const hay = `${c.clientName} ${c.companyName} ${c.phone} ${c.email} ${c.address}`.toLowerCase();
      return (!q || hay.includes(q)) && (!status || c.status === status);
    }));
  }, [clients, search, status]);

  // ─── CRUD handlers ─────────────────────────────────────────
  function openAdd()           { setIsNew(true);  setModal({ ...EMPTY }); }
  function openEdit(c: Client) { setIsNew(false); setModal({ ...c }); }
  function closeModal()        { setModal(null); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setSaving(true);
    try {
      if (isNew) await createClient(modal);
      else       await updateClient(modal.id!, modal);
      closeModal(); fetchClients();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteClient(id); fetchClients();
  }

  // ─── Excel import handlers ────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(""); setImportResult(null);
    try {
      const XLSX = await import("xlsx");
      const wb   = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const data = XLSX.utils.sheet_to_json<ImportRow>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      if (!data.length) { setImportError("No rows found. Check the file."); return; }
      setImportRows(data); setImportState("preview");
    } catch { setImportError("Cannot read file — use .xlsx or .csv only."); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleImportConfirm() {
    setImportState("importing");
    try {
      const res = await importClients(importRows as Record<string, string>[]);
      setImportResult(res); setImportState("done"); fetchClients();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
      setImportState("preview");
    }
  }

  function closeImport() {
    setImportState("idle"); setImportRows([]); setImportResult(null); setImportError("");
  }

  const activeCount   = clients.filter(c => c.status === "ACTIVE").length;
  const inactiveCount = clients.length - activeCount;

  return (
    <AppShell>
      <div className="space-y-5 max-w-7xl mx-auto">

        {/* ── Page header ─────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Users size={22} className="text-purple-600" /> Clients
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">Add, import, edit, delete and export client records</p>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            {canAdd && (
              <button
                onClick={() => { setImportError(""); setImportState("idle"); fileInputRef.current?.click(); }}
                className="btn btn-sm bg-violet-600 text-white hover:bg-violet-700 gap-1.5 px-4 py-2 text-sm"
              >
                <Upload size={15} /> Import Excel
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv"
              className="hidden" onChange={handleFileChange} />
            {canAdd && (
              <button onClick={openAdd} className="btn-primary gap-2 px-4 py-2 text-sm">
                <UserPlus size={15} /> Add Client
              </button>
            )}
          </div>
        </div>

        {/* ── Summary chips ───────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Total",    value: clients.length,  cls: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
            { label: "Active",   value: activeCount,     cls: "bg-green-50  text-green-700  dark:bg-green-900/30  dark:text-green-300"  },
            { label: "Inactive", value: inactiveCount,   cls: "bg-gray-100  text-gray-700   dark:bg-gray-700      dark:text-gray-300"   },
            { label: "Showing",  value: filtered.length, cls: "bg-blue-50   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300"   },
          ].map(s => (
            <div key={s.label} className={`px-4 py-2 rounded-xl text-sm font-semibold ${s.cls}`}>
              {s.label}: <strong>{s.value}</strong>
            </div>
          ))}
        </div>

        {/* ── Toolbar ─────────────────────────────────────── */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name, company, phone, email…" className="form-input pl-9" />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)} className="form-select w-36">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0">
              {(["grid","table"] as const).map(v => (
                <button key={v} onClick={() => {
                  setView(v);
                  localStorage.setItem("s2r2_view_mode", v);
                }}
                  className={`px-3 py-2 text-xs font-semibold transition capitalize ${
                    view === v ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}>{v}</button>
              ))}
            </div>
            <button onClick={fetchClients} className="btn-secondary btn-sm" title="Refresh">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => exportCsv(filtered)}  className="btn btn-sm bg-sky-600     text-white hover:bg-sky-700     gap-1"><FileText     size={12}/>CSV</button>
            <button onClick={() => exportXlsx(filtered)} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 gap-1"><FileSpreadsheet size={12}/>Excel</button>
            <button onClick={exportPdf}                  className="btn btn-sm bg-red-600     text-white hover:bg-red-700     gap-1"><Download      size={12}/>PDF</button>
            {(search || status) && (
              <button onClick={() => { setSearch(""); setStatus(""); }} className="btn-secondary btn-sm">
                <X size={12}/> Reset
              </button>
            )}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="card h-52 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="card py-20 text-center text-gray-400">
            <Users size={56} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium">No clients found</p>
            <p className="text-sm mt-2 flex items-center justify-center gap-3">
              <button onClick={openAdd} className="text-blue-600 hover:underline">+ Add manually</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => fileInputRef.current?.click()} className="text-violet-600 hover:underline">⬆ Import Excel</button>
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(c => (
              <div key={c.id} className="card p-5 hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="font-bold text-gray-800 dark:text-white truncate">{c.clientName}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 size={10} className="text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-500 truncate">{c.companyName || "—"}</span>
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <div className="space-y-1.5 my-4">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Phone size={11} className="shrink-0 text-blue-500" />
                    <span className="truncate">{c.phone || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Mail size={11} className="shrink-0 text-emerald-500" />
                    <span className="truncate">{c.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <MapPin size={11} className="shrink-0 text-red-400" />
                    <span className="truncate">{c.address || "—"}</span>
                  </div>
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-mono">
                    {fmtTs(c.createdAt)}
                  </span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition" title="Edit"><Pencil size={13}/></button>}
                    {canDelete && <button onClick={() => handleDelete(c.id, c.clientName)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition" title="Delete"><Trash2 size={13}/></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr>{["ID","Client Name","Company","Phone","Email","Address","GST No","Status","Created At","Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td className="text-gray-400 text-xs">{c.id}</td>
                      <td className="font-semibold text-gray-800 dark:text-white">{c.clientName}</td>
                      <td>{c.companyName || "—"}</td><td>{c.phone || "—"}</td>
                      <td className="max-w-[160px] truncate">{c.email || "—"}</td>
                      <td>{c.address || "—"}</td><td className="text-xs">{c.gstNo || "—"}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="text-xs text-gray-400 font-mono whitespace-nowrap">{fmtTs(c.createdAt)}</td>
                      <td><div className="flex gap-1.5">
                        {canEdit && <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition" title="Edit"><Pencil size={12}/></button>}
                        {canDelete && <button onClick={() => handleDelete(c.id, c.clientName)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition" title="Delete"><Trash2 size={12}/></button>}
                        {!canEdit && !canDelete && <span className="text-xs text-gray-400 italic">View only</span>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          IMPORT MODAL
          Steps: idle → preview → importing → done
      ══════════════════════════════════════════════════════ */}
      {importState !== "idle" && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeImport(); }}>
          <div className="modal-box w-full max-w-3xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Upload size={18} className="text-violet-600" />
                  {importState === "done" ? "Import Complete" : "Import Clients from Excel"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {importState === "preview"   && `${importRows.length} rows detected — review then confirm`}
                  {importState === "importing" && "Saving to database…"}
                  {importState === "done"      && `${importResult?.created ?? 0} created, ${importResult?.skipped ?? 0} skipped`}
                </p>
              </div>
              <button onClick={closeImport} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Error banner */}
              {importError && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                  <AlertCircle size={16} className="shrink-0" /> {importError}
                </div>
              )}

              {/* Done banner */}
              {importState === "done" && importResult && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <CheckCircle2 size={20} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 dark:text-green-300">
                    <p className="font-semibold">Import successful</p>
                    <p className="mt-0.5">{importResult.created} clients added · {importResult.skipped} skipped (duplicates or empty rows)</p>
                    {importResult.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-green-600 dark:text-green-400">Show {importResult.errors.length} warnings</summary>
                        <ul className="mt-1 space-y-0.5 text-xs opacity-80">
                          {importResult.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              )}

              {/* Template hint */}
              {importState === "preview" && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm">
                  <span className="text-blue-700 dark:text-blue-300 text-xs flex items-center gap-2">
                    <TableProperties size={14} className="shrink-0" />
                    Required column: <strong>Client Name</strong>. Optional: Company, Phone, Email, Address, GST No.
                  </span>
                  <button onClick={downloadTemplate} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold shrink-0 ml-3">
                    Download Template
                  </button>
                </div>
              )}

              {/* Preview table */}
              {importState === "preview" && importRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="data-table text-xs">
                    <thead><tr>
                      <th>#</th>
                      {Object.keys(importRows[0]).map(k => <th key={k}>{k}</th>)}
                    </tr></thead>
                    <tbody>
                      {importRows.slice(0, 20).map((row, i) => (
                        <tr key={i}>
                          <td className="text-gray-400">{i + 1}</td>
                          {Object.values(row).map((v, j) => (
                            <td key={j} className={!v ? "text-gray-300 dark:text-gray-600 italic" : ""}>
                              {String(v || "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importRows.length > 20 && (
                    <p className="text-center text-xs text-gray-400 py-2">
                      Showing first 20 of {importRows.length} rows
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center shrink-0">
              <button onClick={downloadTemplate} className="text-xs text-violet-600 dark:text-violet-400 hover:underline">
                Download template
              </button>
              <div className="flex gap-3">
                <button onClick={closeImport} className="btn-secondary">
                  {importState === "done" ? "Close" : "Cancel"}
                </button>
                {importState === "preview" && (
                  <button onClick={handleImportConfirm} className="btn-primary gap-2 bg-violet-600 hover:bg-violet-700">
                    <Upload size={14} /> Import {importRows.length} Clients
                  </button>
                )}
                {importState === "importing" && (
                  <button disabled className="btn-primary opacity-60 gap-2">
                    <RefreshCw size={14} className="animate-spin" /> Importing…
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ADD / EDIT MODAL
      ══════════════════════════════════════════════════════ */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                  {isNew ? "Add Client" : "Edit Client"}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isNew ? "Fill in details to register a new client" : `Editing: ${modal.clientName}`}
                </p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 grid md:grid-cols-2 gap-4">
              <Field label="Client Name" required>
                <input value={modal.clientName ?? ""} onChange={e => setModal({ ...modal, clientName: e.target.value })}
                  required className="form-input" placeholder="e.g. Tata Motors" />
              </Field>
              <Field label="Company Name">
                <input value={modal.companyName ?? ""} onChange={e => setModal({ ...modal, companyName: e.target.value })}
                  className="form-input" placeholder="Parent company" />
              </Field>
              <Field label="Phone">
                <input type="tel" value={modal.phone ?? ""} onChange={e => setModal({ ...modal, phone: e.target.value })}
                  className="form-input" placeholder="9876543210" />
              </Field>
              <Field label="Email">
                <input type="email" value={modal.email ?? ""} onChange={e => setModal({ ...modal, email: e.target.value })}
                  className="form-input" placeholder="contact@company.com" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Address">
                  <textarea rows={2} value={modal.address ?? ""} onChange={e => setModal({ ...modal, address: e.target.value })}
                    className="form-input resize-none" placeholder="Street, City, State…" />
                </Field>
              </div>
              <Field label="GST Number">
                <input value={modal.gstNo ?? ""} onChange={e => setModal({ ...modal, gstNo: e.target.value })}
                  className="form-input" placeholder="27AAPFU0939F1ZV" />
              </Field>
              <Field label="Status">
                <select value={modal.status ?? "ACTIVE"} onChange={e => setModal({ ...modal, status: e.target.value as Client["status"] })}
                  className="form-select">
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </Field>
              {/* Timestamps — editable for ADMIN, read-only for others */}
              <div className="md:col-span-2 grid grid-cols-2 gap-3 pt-1 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">
                    Created At {isAdmin && !isNew && <span className="text-blue-500 normal-case">(editable)</span>}
                  </p>
                  {isAdmin && !isNew ? (
                    <input
                      type="datetime-local"
                      className="form-input text-xs font-mono"
                      value={toDatetimeLocal((modal as Partial<Client>).createdAt)}
                      onChange={e => setModal({ ...modal, createdAt: e.target.value ? new Date(e.target.value).toISOString() : undefined } as Partial<Client>)}
                    />
                  ) : (
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                      {isNew ? fmtTs(new Date().toISOString()) : fmtTs((modal as Partial<Client>).createdAt)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-1">Today&apos;s Date</p>
                  <p className="text-xs font-mono text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                    {fmtTs(new Date().toISOString())}
                  </p>
                </div>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <><RefreshCw size={14} className="animate-spin" />{isNew ? "Creating…" : "Saving…"}</> : isNew ? "Add Client" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
