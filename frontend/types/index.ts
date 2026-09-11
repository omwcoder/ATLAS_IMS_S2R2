// types/index.ts — Shared TypeScript interfaces

export interface RawMaterial {
  id:          number;
  name:        string;
  category:    string;
  description: string;
  quantity:    number;
  unit:        string;
  supplier:    string;
  location:    string;
  minStock:    number;
  price:       number;
  status:      "active" | "low" | "out";
  lastUpdated: string;
  createdAt:   string;
  updatedAt:   string;
}

export interface FinishedProduct {
  id:          number;
  name:        string;
  qty:         number;
  unit:        string;
  category:    string;
  location:    string | null;
  supplier:    string | null;
  minStock:    number;
  price:       number;
  status:      "ACTIVE" | "HOLD";
  stockStatus: "active" | "low" | "out";
  createdAt:   string;
  updatedAt:   string;
}

export interface Client {
  id:          number;
  clientName:  string;
  companyName: string;
  phone:       string;
  email:       string;
  address:     string;
  gstNo:       string;
  status:      "ACTIVE" | "INACTIVE";
  createdAt:   string;
  updatedAt:   string;
}

// ── Bill of Materials ─────────────────────────────────────────
export interface BomEntry {
  id:               number;
  rawMaterialId:    number;
  rawMaterialName:  string;
  unit:             string;
  currentStock:     number;
  unitPrice:        number;
  quantityRequired: number;
}

export interface BomResponse {
  finishedProductId: number;
  entries:           BomEntry[];
}

// ── Feasibility check ─────────────────────────────────────────
export interface FeasibilityMaterial {
  rawMaterialId: number;
  name:          string;
  unit:          string;
  available:     number;
  required:      number;
  shortfall:     number;
  sufficient:    boolean;
}

export interface FeasibilityResult {
  feasible:   boolean;
  qty:        number;
  reason?:    string;
  materials:  FeasibilityMaterial[];
}

// ── Inventory Transactions ────────────────────────────────────
export type TransactionType = "INWARD" | "OUTWARD" | "MANUFACTURE";
export type ItemType        = "RAW_MATERIAL" | "FINISHED_PRODUCT";

export interface InventoryTransaction {
  id:              number;
  transactionType: TransactionType;
  itemType:        ItemType;
  itemId:          number;
  itemName:        string;
  quantity:        number;
  note:            string | null;
  performedBy:     string;
  createdAt:       string;
}

export interface TransactionResponse {
  transactions: InventoryTransaction[];
  pagination:   { total: number; page: number; limit: number; pages: number };
}

// ── Manufacture result ────────────────────────────────────────
export interface ManufactureResult {
  message:        string;
  produced:       number;
  product:        string;
  deductions:     { name: string; deducted: number; unit: string }[];
  lowStockAlerts: { id: number; name: string; quantity: number; minStock: number; unit: string }[];
}

// ── Dashboard ─────────────────────────────────────────────────
export interface DashboardStats {
  raw_materials: {
    total_items:       number;
    total_qty:         number;
    total_stock_value: number;
    low_stock_count:   number;
    out_of_stock:      number;
  };
  finished_products: {
    total_products:    number;
    total_qty:         number;
    total_stock_value: number;
    ready_stock:       number;
    low_stock_count:   number;
    out_of_stock:      number;
  };
  clients:     { total_clients: number; new_this_month: number };
  iot_devices: { total: number; online: number; offline: number; maintenance: number };
  low_stock_alerts: {
    id: number; name: string; quantity: number;
    unit: string; min_stock: number; module: string;
  }[];
  recent_activity: {
    module: string; label: string; action: string;
    username: string; event_time: string;
  }[];
  stock_movement: { labels: string[]; values: number[] };
  // ── New: manufacture + cost analysis ──────────────────────
  manufacture: {
    total_transactions:  number;
    produced_today:      number;
    produced_this_month: number;
    outward_this_month:  number;
  };
  cost_analysis: {
    raw_material_total_value:    number;
    finished_product_total_value: number;
    potential_revenue:           number;  // sum of (fp.qty * fp.price)
    top_raw_materials: {
      id: number; name: string; quantity: number;
      price: number; total_value: number; unit: string;
    }[];
    top_finished_products: {
      id: number; name: string; qty: number;
      price: number; total_value: number; unit: string;
    }[];
  };
  recent_transactions: InventoryTransaction[];
}

// ── User management ───────────────────────────────────────────
export type UserRole = "ADMIN" | "EDITOR" | "VIEWER";

export interface AppUser {
  id:        number;
  username:  string;
  role:      UserRole;
  createdAt: string;
  updatedAt?: string;
}

// ── IoT Devices ───────────────────────────────────────────────
export type IoTDeviceStatus = "ONLINE" | "OFFLINE" | "MAINTENANCE";

export interface IoTDevice {
  id:        number;
  deviceId:  string;
  name:      string;
  type:      string | null;
  location:  string | null;
  status:    IoTDeviceStatus;
  lastPing:  string | null;
  metadata:  Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ── Activity Log ──────────────────────────────────────────────
export type ActivityModule = "raw_material" | "finished_product" | "client" | "iot_device";
export type ActivityAction = "created" | "updated" | "deleted";

export interface ActivityLog {
  id:        number;
  module:    ActivityModule;
  label:     string;
  action:    ActivityAction;
  username:  string;
  eventTime: string;
}

export interface ActivityResponse {
  logs:       ActivityLog[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

// ── Civi AI — Decision Intelligence ──────────────────────────

export interface ReorderAlert {
  id:          number;
  name:        string;
  category:    string;
  current_qty: number;
  min_stock:   number;
  unit:        string;
  unit_price:  number;
  urgency:     "CRITICAL" | "HIGH" | "MEDIUM";
  ratio:       number;
  supplier:    string | null;
}

export interface ManufactureMaterial {
  raw_material_id:   number;
  name:              string;
  required_per_unit: number;
  available:         number;
  unit:              string;
  can_produce:       number;
  sufficient:        boolean;
}

export interface ManufactureReadiness {
  product_id:       number;
  product_name:     string;
  current_stock:    number;
  min_stock:        number;
  unit:             string;
  feasible:         boolean;
  max_producible:   number;
  material_count:   number;
  materials:        ManufactureMaterial[];
  action_suggested: "MANUFACTURE_NOW" | "MANUFACTURE_SOON" | "RESTOCK_MATERIALS" | "SUFFICIENT";
}

export interface ReplenishmentItem {
  id:             number;
  name:           string;
  category:       string;
  urgency:        "CRITICAL" | "HIGH" | "MEDIUM";
  current_qty:    number;
  min_stock:      number;
  suggested_qty:  number;
  unit:           string;
  unit_price:     number;
  estimated_cost: number;
  supplier:       string | null;
}

export interface VelocityItem {
  id:             number;
  name:           string;
  unit:           string;
  current_qty:    number;
  consumed_30d:   number;
  daily_avg:      number;
  days_remaining: number | null;
  risk:           "HIGH" | "MEDIUM" | "LOW" | "STABLE";
}

export interface IntelligenceData {
  generated_at:  string;
  powered_by:    string;
  summary: {
    critical_reorder:                number;
    high_reorder:                    number;
    medium_reorder:                  number;
    products_ready_to_manufacture:   number;
    products_need_restock:           number;
    replenishment_items:             number;
    replenishment_est_cost:          number;
    total_alerts:                    number;
  };
  reorder_alerts:        ReorderAlert[];
  manufacture_readiness: ManufactureReadiness[];
  replenishment_plan:    ReplenishmentItem[];
  velocity:              VelocityItem[];
  ai_narrative?: {
    available:    boolean;
    model?:       string;
    narrative?:   string | null;
    tokens_used?: number;
    error?:       string;
  };
}
