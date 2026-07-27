// ---------------------------------------------------------------------------
// STORE TYPES — the single source of truth for how billing adapts to each kind
// of business. Each type declares:
//   • labels for the item / quantity columns,
//   • extra PER-LINE fields (stored in bill_items.meta), e.g. batch + expiry,
//   • whether per-line discount % is shown,
//   • bill-level extras (service charge, table no, order type, notes).
// Adding a new store type = adding one entry here; the billing form, invoice,
// and settings screen all read from this config.
// ---------------------------------------------------------------------------

export type StoreType =
  | 'grocery'
  | 'medical'
  | 'restaurant'
  | 'apparel'
  | 'electronics'
  | 'services';

export type LineFieldType = 'text' | 'date' | 'number';

export type LineField = {
  key: string; // stored in bill_items.meta[key]
  label: string;
  type: LineFieldType;
  placeholder?: string;
};

export type BillExtra = 'service_charge' | 'table_no' | 'order_type' | 'notes';

export type StoreTypeConfig = {
  key: StoreType;
  label: string;
  emoji: string;
  blurb: string;
  itemLabel: string; // header for the item column
  qtyLabel: string; // header for the qty column
  customerLabel?: string; // override "Customer" label (e.g. "Patient Name")
  lineFields: LineField[]; // extra inputs shown on every item row
  lineDiscount: boolean; // show a per-line discount % column
  billExtras: BillExtra[]; // bill-level extras beyond discount % + tax %
  expiryAlerts: boolean; // surface expiry reminders (medical)
  hideTax?: boolean; // hide Tax / GST % field from billing form
  medicalExtras?: boolean; // show patient address, doctor name, doctor address
};

export const STORE_TYPES: Record<StoreType, StoreTypeConfig> = {
  grocery: {
    key: 'grocery',
    label: 'Grocery / General Store',
    emoji: '🛒',
    blurb: 'Simple item · qty · rate billing.',
    itemLabel: 'Item',
    qtyLabel: 'Qty',
    lineFields: [],
    lineDiscount: false,
    billExtras: [],
    expiryAlerts: false,
  },
  medical: {
    key: 'medical',
    label: 'Medical / Pharmacy',
    emoji: '💊',
    blurb: 'Patient & doctor info, batch number, expiry date.',
    itemLabel: 'Medicine',
    qtyLabel: 'Qty',
    customerLabel: 'Patient Name',
    lineFields: [
      { key: 'batch_no', label: 'Batch no.', type: 'text', placeholder: 'B-1234' },
      { key: 'expiry_date', label: 'Expiry', type: 'date' },
    ],
    lineDiscount: false,
    billExtras: [],
    expiryAlerts: true,
    hideTax: true,
    medicalExtras: true,
  },
  restaurant: {
    key: 'restaurant',
    label: 'Restaurant / Café',
    emoji: '🍽️',
    blurb: 'Table number, dine-in / takeaway, and a service charge.',
    itemLabel: 'Dish',
    qtyLabel: 'Qty',
    lineFields: [],
    lineDiscount: false,
    billExtras: ['table_no', 'order_type', 'service_charge'],
    expiryAlerts: false,
  },
  apparel: {
    key: 'apparel',
    label: 'Retail / Apparel',
    emoji: '👕',
    blurb: 'Size / variant, HSN code, and per-item discount.',
    itemLabel: 'Product',
    qtyLabel: 'Qty',
    lineFields: [
      { key: 'size', label: 'Size / Variant', type: 'text', placeholder: 'M / Red' },
      { key: 'hsn', label: 'HSN', type: 'text', placeholder: 'HSN code' },
    ],
    lineDiscount: true,
    billExtras: [],
    expiryAlerts: false,
  },
  electronics: {
    key: 'electronics',
    label: 'Electronics / Hardware',
    emoji: '🔌',
    blurb: 'Serial / model number and warranty period.',
    itemLabel: 'Product',
    qtyLabel: 'Qty',
    lineFields: [
      { key: 'serial', label: 'Serial / Model', type: 'text', placeholder: 'SN-000' },
      { key: 'warranty', label: 'Warranty (mo.)', type: 'number', placeholder: '12' },
    ],
    lineDiscount: false,
    billExtras: [],
    expiryAlerts: false,
  },
  services: {
    key: 'services',
    label: 'Services / Freelance',
    emoji: '🧑‍💻',
    blurb: 'Bill by description × hours × rate, with notes.',
    itemLabel: 'Service / Description',
    qtyLabel: 'Hours',
    lineFields: [],
    lineDiscount: false,
    billExtras: ['notes'],
    expiryAlerts: false,
  },
};

export const STORE_TYPE_LIST = Object.values(STORE_TYPES);

export function getStoreConfig(t: string | null | undefined): StoreTypeConfig {
  return STORE_TYPES[(t as StoreType) ?? 'grocery'] ?? STORE_TYPES.grocery;
}
