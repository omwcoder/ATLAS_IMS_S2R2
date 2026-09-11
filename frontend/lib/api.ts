// lib/api.ts — Centralised API client
// All fetch calls go through here so the auth header is always set.

const BASE = "/api"; // proxied by next.config.js → Express :4000

function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("s2r2_token") || "";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("s2r2_token");
    window.location.href = "/login";
    throw new Error("Unauthorised");
  }

  // 402 handling removed — app is fully licensed, no trial gate

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────
export async function login(username: string, password: string) {
  // Use AbortController timeout so login doesn't hang silently if backend is unreachable
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    localStorage.setItem("s2r2_token",    body.token);
    localStorage.setItem("s2r2_username", body.username);
    localStorage.setItem("s2r2_role",     body.role);
    return body as { token: string; username: string; role: string };
  } catch (err: unknown) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Connection timeout — backend unreachable. Check NEXT_PUBLIC_API_URL.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export function logout() {
  localStorage.removeItem("s2r2_token");
  localStorage.removeItem("s2r2_username");
  localStorage.removeItem("s2r2_role");
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

// ── Dashboard ─────────────────────────────────────────────────
export const getDashboardStats = () =>
  request<import("../types").DashboardStats>("/dashboard/stats");

// ── Raw Materials ─────────────────────────────────────────────
export const getRawMaterials = (params = "") =>
  request<{ items: import("../types").RawMaterial[] }>(`/raw-materials${params ? "?" + params : ""}`);

export const createRawMaterial = (data: Partial<import("../types").RawMaterial>) =>
  request("/raw-materials", { method: "POST", body: JSON.stringify(data) });

export const updateRawMaterial = (id: number, data: Partial<import("../types").RawMaterial>) =>
  request(`/raw-materials/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteRawMaterial = (id: number) =>
  request(`/raw-materials/${id}`, { method: "DELETE" });

// ── Finished Products ─────────────────────────────────────────
export const getFinishedProducts = (params = "") =>
  request<{ products: import("../types").FinishedProduct[] }>(`/finished-products${params ? "?" + params : ""}`);

export const createFinishedProduct = (data: Partial<import("../types").FinishedProduct>) =>
  request("/finished-products", { method: "POST", body: JSON.stringify(data) });

export const updateFinishedProduct = (id: number, data: Partial<import("../types").FinishedProduct>) =>
  request(`/finished-products/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteFinishedProduct = (id: number) =>
  request(`/finished-products/${id}`, { method: "DELETE" });

// ── Clients ───────────────────────────────────────────────────
export const getClients = (params = "") =>
  request<{ clients: import("../types").Client[] }>(`/clients${params ? "?" + params : ""}`);

export const createClient = (data: Partial<import("../types").Client>) =>
  request("/clients", { method: "POST", body: JSON.stringify(data) });

export const updateClient = (id: number, data: Partial<import("../types").Client>) =>
  request(`/clients/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteClient = (id: number) =>
  request(`/clients/${id}`, { method: "DELETE" });

export const importClients = (rows: Record<string, string>[]) =>
  request<{ created: number; skipped: number; errors: string[] }>(
    "/clients/import",
    { method: "POST", body: JSON.stringify({ rows }) }
  );

// ── IoT Devices ───────────────────────────────────────────────
export const getIoTDevices = (params = "") =>
  request<{ devices: import("../types").IoTDevice[] }>(`/iot-devices${params ? "?" + params : ""}`);

export const createIoTDevice = (data: Partial<import("../types").IoTDevice>) =>
  request("/iot-devices", { method: "POST", body: JSON.stringify(data) });

export const updateIoTDevice = (id: number, data: Partial<import("../types").IoTDevice>) =>
  request(`/iot-devices/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteIoTDevice = (id: number) =>
  request(`/iot-devices/${id}`, { method: "DELETE" });

export const pingIoTDevice = (id: number) =>
  request(`/iot-devices/${id}/ping`, { method: "PATCH" });

// ── Activity Log ──────────────────────────────────────────────
export const getActivity = (params = "") =>
  request<import("../types").ActivityResponse>(`/activity${params ? "?" + params : ""}`);

export const getActivityUsers = () =>
  request<{ users: string[] }>("/activity/users");

export const clearActivity = () =>
  request("/activity", { method: "DELETE" });

// ── User management (ADMIN only) ──────────────────────────────
export const getUsers = () =>
  request<{ users: import("../types").AppUser[] }>("/users");

export const getMe = () =>
  request<import("../types").AppUser>("/users/me");

export const createUser = (data: { username: string; password: string; role: string }) =>
  request<import("../types").AppUser>("/users", { method: "POST", body: JSON.stringify(data) });

export const updateUser = (id: number, data: { username?: string; role?: string; password?: string }) =>
  request<import("../types").AppUser>(`/users/${id}`, { method: "PUT", body: JSON.stringify(data) });

export const deleteUser = (id: number) =>
  request(`/users/${id}`, { method: "DELETE" });

// ── Manufacture / BOM / Transactions ─────────────────────────

export const getBom = (finishedProductId: number) =>
  request<import("../types").BomResponse>(`/manufacture/bom/${finishedProductId}`);

export const setBom = (finishedProductId: number, entries: { rawMaterialId: number; quantityRequired: number }[]) =>
  request(`/manufacture/bom/${finishedProductId}`, { method: "POST", body: JSON.stringify({ entries }) });

export const getFeasibility = (finishedProductId: number, qty: number) =>
  request<import("../types").FeasibilityResult>(`/manufacture/feasibility/${finishedProductId}?qty=${qty}`);

export const inwardStock = (data: { itemType: "RAW_MATERIAL" | "FINISHED_PRODUCT"; itemId: number; quantity: number; note?: string }) =>
  request(`/manufacture/inward`, { method: "POST", body: JSON.stringify(data) });

export const outwardStock = (data: { itemId: number; quantity: number; note?: string }) =>
  request(`/manufacture/outward`, { method: "POST", body: JSON.stringify(data) });

export const produceProduct = (data: { finishedProductId: number; quantity: number; note?: string }) =>
  request<import("../types").ManufactureResult>(`/manufacture/produce`, { method: "POST", body: JSON.stringify(data) });

export const getTransactions = (params = "") =>
  request<import("../types").TransactionResponse>(`/manufacture/transactions${params ? "?" + params : ""}`);

// ── Raw Material stock movements ──────────────────────────────
export const inwardRawMaterial = (id: number, data: { quantity: number; note?: string }) =>
  request(`/raw-materials/${id}/inward`, { method: "POST", body: JSON.stringify(data) });

export const outwardRawMaterial = (id: number, data: { quantity: number; note?: string }) =>
  request(`/raw-materials/${id}/outward`, { method: "POST", body: JSON.stringify(data) });

// ── Excel bulk import ─────────────────────────────────────────
export const importRawMaterials = (rows: Record<string, unknown>[]) =>
  request<{ created: number; skipped: number; errors: string[] }>(
    "/raw-materials/import",
    { method: "POST", body: JSON.stringify({ rows }) }
  );

export const importFinishedProducts = (rows: Record<string, unknown>[]) =>
  request<{ created: number; skipped: number; errors: string[] }>(
    "/finished-products/import",
    { method: "POST", body: JSON.stringify({ rows }) }
  );

// ── BOM management ────────────────────────────────────────────
export const getAllBoms = () =>
  request<{ products: { id: number; name: string; unit: string; entries: import("../types").BomEntry[] }[] }>("/manufacture/bom/all");

export const getFinishedProductsWithBom = async () => {
  const { products } = await request<{ products: import("../types").FinishedProduct[] }>("/finished-products");
  return products;
};

// ── Civi AI — Decision Intelligence ──────────────────────────
export const getIntelligence = () =>
  request<import("../types").IntelligenceData>("/intelligence");

export function exportIntelligencePdf(token: string) {
  const a = document.createElement("a");
  a.href = `/api/intelligence/export/pdf`;
  // Trigger via fetch to pass auth header, then download
  fetch("/api/intelligence/export/pdf", {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => { if (!r.ok) throw new Error("PDF failed"); return r.blob(); })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url;
      a.download = "civi-ai-intelligence-report.pdf";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(console.error);
}
