// ---------------------------------------------------------------------------
// DATA MODELS (TypeScript types)
// ---------------------------------------------------------------------------
// These describe the SHAPE of your data — what fields each thing has and what
// type each field is. They match the database tables one-to-one. Defining them
// gives you auto-complete and catches mistakes like a typo'd field name BEFORE
// the app ever runs.
//
// 🔑 Notice `user_id` on Customer, Item, and Bill. That single field is the
//    heart of your privacy requirement: every row is stamped with its owner,
//    and the database will only ever let a user read rows where user_id = them.
// ---------------------------------------------------------------------------

// A business owner / shopkeeper who signs up and logs in.
export interface UserProfile {
  id: string; // unique user id (from Supabase Auth)
  email: string;
  created_at: string; // ISO date string, e.g. "2026-06-13T10:00:00Z"
}

// Tracks each user's trial / paid subscription state.
export interface Subscription {
  id: string;
  user_id: string; // owner
  trial_start: string; // when the current period began
  trial_end: string | null; // when access ends (NULL = permanent / unlimited)
  status: 'frozen' | 'trial' | 'active' | 'expired';
  plan?: string | null; // 'trial' | '1m' | '3m' | '6m' | '1y' | 'permanent'
  // Inventory is an admin-gated feature (migration 004): only the admin can
  // turn it on for a user; the user can read this but not change it.
  inventory_enabled?: boolean;
}

// A customer/account that the shopkeeper bills.
export interface Customer {
  id: string;
  user_id: string; // owner — keeps customers private per user
  customer_name: string;
  is_frozen: boolean; // frozen accounts cannot be billed
  created_at: string;
}

// A product/item the shopkeeper sells (used for item autocomplete).
export interface Item {
  id: string;
  user_id: string; // owner — keeps items private per user
  item_name: string;
  default_rate: number | null; // optional default price (null = none yet)
  created_at: string;
  // Inventory (migration 004) — optional per-user stock tracking.
  track_stock?: boolean; // does this item deduct stock when sold?
  stock_qty?: number; // current stock on hand (cache of the movement ledger)
  reorder_level?: number; // low-stock threshold for alerts
  cost_price?: number | null; // purchase cost, used for stock valuation
}

// One row in the stock ledger (migration 004). Append-only source of truth;
// items.stock_qty is derived from the sum of these.
export interface StockMovement {
  id: string;
  user_id: string;
  item_id: string;
  change: number; // +restock / -sale / ± adjustment
  reason: 'sale' | 'restock' | 'adjustment' | 'return' | 'opening';
  bill_id?: string | null;
  note?: string | null;
  created_at: string;
}

// A single generated bill (the header / summary).
export interface Bill {
  id: string;
  user_id: string; // owner
  customer_id: string | null; // which customer (null if that customer was deleted)
  customer_name: string; // snapshot of the name at bill time (stays correct in history)
  bill_number: string; // e.g. "INV-1024"
  total_amount: number; // the grand total
  created_at: string;
  // Added in migration 002 (optional so older rows still type-check):
  subtotal?: number;
  discount_amount?: number;
  tax_percent?: number;
  tax_amount?: number;
  extra?: BillExtra;
}

// Free-form per-store extras stored on the bill (service charge, table no,
// order type, notes, and a snapshot of the store_type used).
export interface BillExtra {
  store_type?: string;
  discount_percent?: number;
  service_charge_percent?: number;
  service_charge_amount?: number;
  table_no?: string;
  order_type?: string; // 'dine-in' | 'takeaway'
  notes?: string;
  [key: string]: unknown;
}

// One row inside a bill (item name + qty + rate + line total).
export interface BillItem {
  id: string;
  bill_id: string; // which bill this line belongs to
  item_name: string;
  qty: number;
  rate: number;
  total: number; // qty * rate, after the per-line discount
  // Added in migration 002:
  discount?: number; // per-line discount %
  meta?: Record<string, string>; // batch_no, expiry_date, hsn, size, serial, warranty…
}

// Per-user settings + shop profile (one row per user).
export interface Settings {
  user_id: string;
  store_type: string;
  shop_name: string | null;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  updated_at?: string;
}
