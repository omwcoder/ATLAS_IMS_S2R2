"use client";
export const dynamic = "force-dynamic";

// app/admin/page.tsx — User management + editable live permission grid
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { getUsers, createUser, updateUser, deleteUser } from "@/lib/api";
import { AppUser, UserRole } from "@/types";
import { ShieldCheck, UserPlus, Pencil, Trash2, X, RefreshCw, Key, Users, Shield, Eye, FilePen, Save } from "lucide-react";
// ─── Role display config ────────────────────────────────────
const ROLES: { value: UserRole; label: string; desc: string; cls: string }[] = [
  { value: "ADMIN",  label: "Admin",  desc: "Full access — manage users, edit all data", cls: "bg-red-50  text-red-700  dark:bg-red-900/30  dark:text-red-300  border border-red-200  dark:border-red-800"  },
  { value: "EDITOR", label: "Editor", desc: "Add & edit records — cannot delete or manage users", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800" },
  { value: "VIEWER", label: "Viewer", desc: "Read-only — view and export only", cls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600" },
];

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLES.find(r => r.value === role) ?? ROLES[2];
  return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

// ─── Default permission matrix ───────────────────────────────
const DEFAULT_PERMS: { feature: string; admin: boolean; editor: boolean; viewer: boolean }[] = [
  { feature: "View Dashboard & Reports",  admin: true,  editor: true,  viewer: true  },
  { feature: "View Activity Log",         admin: true,  editor: true,  viewer: true  },
  { feature: "Export CSV / Excel / PDF",  admin: true,  editor: true,  viewer: true  },
  { feature: "Add Raw Materials",         admin: true,  editor: true,  viewer: false },
  { feature: "Edit Raw Materials",        admin: true,  editor: true,  viewer: false },
  { feature: "Delete Raw Materials",      admin: true,  editor: false, viewer: false },
  { feature: "Add Finished Products",     admin: true,  editor: true,  viewer: false },
  { feature: "Edit Finished Products",    admin: true,  editor: true,  viewer: false },
  { feature: "Delete Finished Products",  admin: true,  editor: false, viewer: false },
  { feature: "Add / Edit Clients",        admin: true,  editor: true,  viewer: false },
  { feature: "Import Clients (Excel)",    admin: true,  editor: true,  viewer: false },
  { feature: "Delete Clients",            admin: true,  editor: false, viewer: false },
  { feature: "Add / Edit IoT Devices",    admin: true,  editor: false, viewer: false },
  { feature: "Delete IoT Devices",        admin: true,  editor: false, viewer: false },
  { feature: "Manage Users",              admin: true,  editor: false, viewer: false },
  { feature: "View Pricing & Revenue",    admin: true,  editor: true,  viewer: false },
];

const PERM_KEY = "s2r2_permissions";
function loadPerms() {
  try {
    const s = localStorage.getItem(PERM_KEY);
    return s ? JSON.parse(s) : DEFAULT_PERMS;
  } catch { return DEFAULT_PERMS; }
}
function savePerms(p: typeof DEFAULT_PERMS) {
  localStorage.setItem(PERM_KEY, JSON.stringify(p));
}

const EMPTY_USER = { username: "", password: "", role: "VIEWER" as UserRole };

export default function AdminPage() {
  const [users,   setUsers]   = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [modal,   setModal]   = useState<Partial<typeof EMPTY_USER & { id?: number }> | null>(null);
  const [isNew,   setIsNew]   = useState(false);
  const [error,   setError]   = useState("");
  const [perms,   setPerms]   = useState(DEFAULT_PERMS);
  const [permSaved, setPermSaved] = useState(false);

  const myRole = typeof window !== "undefined" ? localStorage.getItem("s2r2_role") || "" : "";
  const isAdmin = myRole === "ADMIN";

  useEffect(() => { setPerms(loadPerms()); }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try { const { users } = await getUsers(); setUsers(users); }
    catch { /* 403 for non-admins */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openAdd()            { setIsNew(true);  setError(""); setModal({ ...EMPTY_USER }); }
  function openEdit(u: AppUser) { setIsNew(false); setError(""); setModal({ id: u.id, username: u.username, role: u.role, password: "" }); }
  function closeModal()         { setModal(null); setError(""); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!modal) return;
    setSaving(true); setError("");
    try {
      if (isNew) { await createUser({ username: modal.username!, password: modal.password!, role: modal.role! }); }
      else {
        const p: Record<string, string> = { role: modal.role! };
        if (modal.username) p.username = modal.username;
        if (modal.password) p.password = modal.password;
        await updateUser(modal.id!, p);
      }
      closeModal(); fetchUsers();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete user "${name}"? They lose access immediately.`)) return;
    await deleteUser(id); fetchUsers();
  }

  function togglePerm(idx: number, col: "editor" | "viewer") {
    setPerms(prev => {
      const next = prev.map((r, i) => i === idx ? { ...r, [col]: !r[col] } : r);
      return next;
    });
    setPermSaved(false);
  }

  function handleSavePerms() {
    savePerms(perms);
    setPermSaved(true);
    setTimeout(() => setPermSaved(false), 2500);
  }

  function handleResetPerms() {
    setPerms(DEFAULT_PERMS);
    savePerms(DEFAULT_PERMS);
    setPermSaved(true);
    setTimeout(() => setPermSaved(false), 2500);
  }

  const totalAdmins  = users.filter(u => u.role === "ADMIN").length;
  const totalEditors = users.filter(u => u.role === "EDITOR").length;
  const totalViewers = users.filter(u => !["ADMIN","EDITOR"].includes(u.role)).length;

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <ShieldCheck size={24} className="text-red-600" /> Admin Panel
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">Manage users, roles and live access permissions</p>
          </div>
          {isAdmin && (
            <button onClick={openAdd} className="btn-primary self-start gap-2">
              <UserPlus size={16} /> Add User
            </button>
          )}
        </div>

        {!isAdmin && (          <div className="card p-10 text-center text-gray-400">
            <ShieldCheck size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-semibold text-lg">Admin access required</p>
            <p className="text-sm mt-1">Only administrators can manage users and permissions.</p>
          </div>
        )}

        {isAdmin && (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Total Users", value: users.length,    cls: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
                { label: "Admins",      value: totalAdmins,     cls: "bg-red-50    text-red-700    dark:bg-red-900/30    dark:text-red-300"    },
                { label: "Editors",     value: totalEditors,    cls: "bg-blue-50   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300"   },
                { label: "Viewers",     value: totalViewers,    cls: "bg-gray-100  text-gray-700   dark:bg-gray-700      dark:text-gray-300"   },
              ].map(s => (
                <div key={s.label} className={`px-4 py-2 rounded-xl text-sm font-semibold ${s.cls}`}>
                  {s.label}: <strong>{s.value}</strong>
                </div>
              ))}
            </div>

            {/* Users table */}
            <div className="card overflow-hidden">
              <div className="section-header">
                <span className="font-semibold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2"><Users size={15}/>System Users</span>
                <button onClick={fetchUsers} className="btn-secondary btn-sm">
                  <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr>{["ID","Username","Role","Description","Created","Actions"].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
                    ) : users.map(u => {
                      const cfg = ROLES.find(r => r.value === u.role) ?? ROLES[2];
                      return (
                        <tr key={u.id}>
                          <td className="text-gray-400 text-xs">{u.id}</td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {u.username[0].toUpperCase()}
                              </div>
                              <span className="font-semibold text-gray-800 dark:text-white">{u.username}</span>
                            </div>
                          </td>
                          <td><RoleBadge role={u.role} /></td>
                          <td className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">{cfg.desc}</td>
                          <td className="text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td><div className="flex gap-1.5">
                            <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 transition" title="Edit"><Pencil size={13}/></button>
                            <button onClick={() => handleDelete(u.id, u.username)} className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100 transition" title="Delete"><Trash2 size={13}/></button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Editable permissions grid ──────────────── */}
            <div className="card overflow-hidden">
              <div className="section-header">
                <span className="font-semibold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Key size={15}/> Access Permissions
                  <span className="text-xs font-normal text-gray-400">(Admin is always full access — toggle Editor / Viewer)</span>
                </span>
                <div className="flex gap-2 items-center">
                  {permSaved && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                      ✓ Saved
                    </span>
                  )}
                  <button onClick={handleResetPerms} className="btn-secondary btn-sm">Reset</button>
                  <button onClick={handleSavePerms} className="btn-primary btn-sm gap-1">
                    <Save size={12}/> Save Changes
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Feature / Permission</th>
                      <th className="text-center w-24">
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-semibold"><Shield size={12}/>Admin</span>
                      </th>
                      <th className="text-center w-28">
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-xs font-semibold"><FilePen size={12}/>Editor</span>
                      </th>
                      <th className="text-center w-28">
                        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400 text-xs font-semibold"><Eye size={12}/>Viewer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {perms.map((row, idx) => (
                      <tr key={row.feature}>
                        <td className="font-medium text-gray-700 dark:text-gray-300 text-sm">{row.feature}</td>

                        {/* Admin — always on, not editable */}
                        <td className="text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30">
                            <span className="text-green-600 dark:text-green-400 text-sm font-bold">✓</span>
                          </span>
                        </td>

                        {/* Editor toggle */}
                        <td className="text-center">
                          <button
                            onClick={() => togglePerm(idx, "editor")}
                            title={row.editor ? "Click to revoke Editor access" : "Click to grant Editor access"}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border-2 transition-all ${
                              row.editor
                                ? "bg-blue-500 border-blue-500 text-white hover:bg-blue-600"
                                : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:border-blue-400 hover:text-blue-400"
                            }`}
                          >
                            {row.editor ? "✓" : "✕"}
                          </button>
                        </td>

                        {/* Viewer toggle */}
                        <td className="text-center">
                          <button
                            onClick={() => togglePerm(idx, "viewer")}
                            title={row.viewer ? "Click to revoke Viewer access" : "Click to grant Viewer access"}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-xl border-2 transition-all ${
                              row.viewer
                                ? "bg-gray-500 border-gray-500 text-white hover:bg-gray-600"
                                : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:border-gray-400 hover:text-gray-400"
                            }`}
                          >
                            {row.viewer ? "✓" : "✕"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900/30 text-xs text-amber-700 dark:text-amber-400">
                ⚠️ Permission changes are saved locally in the browser. The backend enforces role-based guards independently — update route middleware for server-side enforcement.
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add / Edit User Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-box w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">{isNew ? "Add User" : "Edit User"}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{isNew ? "Create a new system user" : `Editing: ${modal.username}`}</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition"><X size={18}/></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">⚠️ {error}</div>
              )}
              <Field label="Username *">
                <input value={modal.username ?? ""} onChange={e => setModal({ ...modal, username: e.target.value })}
                  required={isNew} placeholder={isNew ? "e.g. john_doe" : "Leave blank to keep"}
                  className="form-input" autoComplete="off" />
              </Field>
              <Field label={isNew ? "Password *" : "New Password (blank = keep)"}>
                <input type="password" value={modal.password ?? ""} onChange={e => setModal({ ...modal, password: e.target.value })}
                  required={isNew} placeholder={isNew ? "Min 6 characters" : "Leave blank to keep"}
                  className="form-input" autoComplete="new-password" />
              </Field>
              <Field label="Role *">
                <div className="space-y-2">
                  {ROLES.map(r => (
                    <label key={r.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      modal.role === r.value ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}>
                      <input type="radio" name="role" value={r.value} checked={modal.role === r.value}
                        onChange={() => setModal({ ...modal, role: r.value })} className="mt-0.5 accent-blue-600" />
                      <div>
                        <RoleBadge role={r.value} />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </Field>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? <><RefreshCw size={14} className="animate-spin"/>{isNew ? "Creating…" : "Saving…"}</> : isNew ? "Create User" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
