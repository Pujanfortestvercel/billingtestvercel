// ---------------------------------------------------------------------------
// INVOICE — build a printable, store-aware HTML invoice with the shop's profile
// header (logo, name, phone, address), store-specific columns (batch/expiry,
// size/HSN, serial/warranty…), a full discount/service-charge/tax breakdown,
// plus a shareable text version. Actions: PRINT (system dialog → Save as PDF)
// and SHARE (e.g. WhatsApp).
// ---------------------------------------------------------------------------
import RNPrint from 'react-native-print';
import Share from 'react-native-share';
import type { Bill, BillItem, Settings } from '../types/models';
import { formatCurrency, formatDateTime } from './format';
import { APP_NAME } from '../config/constants';
import { getStoreConfig } from '../config/storeTypes';

const META_LABELS: Record<string, string> = {
  size: 'Size',
  batch_no: 'Batch',
  expiry_date: 'Expiry',
  hsn: 'HSN',
  serial: 'Serial / Model',
  warranty: 'Warranty (mo.)',
};
const META_ORDER = ['size', 'batch_no', 'expiry_date', 'hsn', 'serial', 'warranty'];

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The store-aware invoice markup (inline-styled, self-contained).
export function buildInvoiceHtml(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): string {
  const store = getStoreConfig(bill.extra?.store_type ?? settings?.store_type);
  const presentMeta = META_ORDER.filter(k => items.some(it => it.meta && it.meta[k]));
  const showDisc = items.some(it => (it.discount ?? 0) > 0);

  const headCells = [
    `<th>${esc(store.itemLabel)}</th>`,
    ...presentMeta.map(k => `<th>${esc(META_LABELS[k])}</th>`),
    `<th class="num">${esc(store.qtyLabel)}</th>`,
    `<th class="num">Rate</th>`,
    showDisc ? `<th class="num">Disc %</th>` : '',
    `<th class="num">Total</th>`,
  ].join('');

  const bodyRows = items
    .map(it => {
      const metaCells = presentMeta.map(k => `<td>${esc(it.meta?.[k] ?? '—')}</td>`).join('');
      return `<tr>
        <td>${esc(it.item_name)}</td>
        ${metaCells}
        <td class="num">${it.qty}</td>
        <td class="num">${formatCurrency(it.rate)}</td>
        ${showDisc ? `<td class="num">${it.discount ?? 0}%</td>` : ''}
        <td class="num">${formatCurrency(it.total)}</td>
      </tr>`;
    })
    .join('');

  const subtotal = bill.subtotal ?? items.reduce((s, it) => s + it.total, 0);
  const discount = bill.discount_amount ?? 0;
  const serviceCharge = Number(bill.extra?.service_charge_amount ?? 0);
  const tax = bill.tax_amount ?? 0;

  const breakdown = [
    `<tr><td>Subtotal</td><td class="num">${formatCurrency(subtotal)}</td></tr>`,
    discount > 0
      ? `<tr><td>Discount (${esc(bill.extra?.discount_percent ?? 0)}%)</td><td class="num">– ${formatCurrency(discount)}</td></tr>`
      : '',
    serviceCharge > 0
      ? `<tr><td>Service charge (${esc(bill.extra?.service_charge_percent ?? 0)}%)</td><td class="num">+ ${formatCurrency(serviceCharge)}</td></tr>`
      : '',
    tax > 0
      ? `<tr><td>Tax / GST (${esc(bill.tax_percent ?? 0)}%)</td><td class="num">+ ${formatCurrency(tax)}</td></tr>`
      : '',
    `<tr class="grand"><td>Grand Total</td><td class="num">${formatCurrency(bill.total_amount)}</td></tr>`,
  ].join('');

  const shopName = settings?.shop_name || APP_NAME;
  const logo = settings?.logo_url
    ? `<img src="${esc(settings.logo_url)}" style="width:54px;height:54px;border-radius:8px;object-fit:cover" />`
    : `<div style="font-size:42px">${store.emoji}</div>`;
  const contact = [settings?.phone, settings?.address].filter(Boolean).map(esc).join(' · ');

  const orderMeta = [
    bill.extra?.table_no ? `Table: ${esc(bill.extra.table_no)}` : '',
    bill.extra?.order_type ? `(${esc(bill.extra.order_type)})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body { font-family: -apple-system, Roboto, Arial, sans-serif; color:#111827; padding:24px; }
        h1 { margin:0; font-size:24px; color:#2563EB; }
        .muted { color:#6B7280; font-size:13px; }
        .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #2563EB; padding-bottom:16px; }
        table { width:100%; border-collapse:collapse; margin-top:20px; }
        th, td { text-align:left; padding:9px 8px; border-bottom:1px solid #E5E7EB; font-size:13px; }
        th { background:#F3F4F6; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#6B7280; }
        .num { text-align:right; }
        .totals { margin-top:18px; margin-left:auto; width:300px; }
        .totals td { border:none; padding:5px 8px; }
        .totals .grand td { border-top:2px solid #111827; font-size:17px; font-weight:800; padding-top:10px; }
        .foot { margin-top:30px; text-align:center; color:#9CA3AF; font-size:12px; }
        .notes { margin-top:16px; font-size:13px; color:#374151; }
      </style>
    </head>
    <body>
      <div class="head">
        <div style="display:flex; gap:12px; align-items:center;">
          ${logo}
          <div>
            <h1>${esc(shopName)}</h1>
            ${contact ? `<div class="muted">${contact}</div>` : ''}
            <div class="muted">${esc(store.label)} · Tax Invoice</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:17px"><strong>${esc(bill.bill_number)}</strong></div>
          <div class="muted">${esc(formatDateTime(bill.created_at))}</div>
          ${orderMeta ? `<div class="muted">${orderMeta}</div>` : ''}
        </div>
      </div>

      <div style="margin-top:16px; padding:12px; background:#F9FAFB; border:1px solid #E5E7EB; border-radius:6px; font-size:13px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <div style="font-weight:700; color:#2563EB; margin-bottom:3px;">${esc(store.customerLabel ? 'Patient Details' : 'Billed To')}</div>
          <div><strong>${esc(store.customerLabel ?? 'Name')}:</strong> ${esc(bill.customer_name)}</div>
          ${bill.extra?.patient_address ? `<div style="margin-top:2px"><strong>Address:</strong> ${esc(String(bill.extra.patient_address))}</div>` : ''}
        </div>
        ${bill.extra?.doctor_name || bill.extra?.doctor_address ? `
        <div>
          <div style="font-weight:700; color:#2563EB; margin-bottom:3px;">Prescribing Doctor</div>
          ${bill.extra?.doctor_name ? `<div><strong>Doctor Name:</strong> ${esc(String(bill.extra.doctor_name))}</div>` : ''}
          ${bill.extra?.doctor_address ? `<div style="margin-top:2px"><strong>Doctor Address:</strong> ${esc(String(bill.extra.doctor_address))}</div>` : ''}
        </div>
        ` : ''}
      </div>

      <table>
        <thead><tr>${headCells}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>

      <table class="totals">${breakdown}</table>

      ${bill.extra?.notes ? `<div class="notes"><strong>Notes:</strong> ${esc(bill.extra.notes)}</div>` : ''}

      <div class="foot">Thank you for your business · Generated by ${esc(shopName)}</div>
    </body>
  </html>`;
}

// A plain-text version for sharing as a message (WhatsApp, SMS, etc.).
export function buildInvoiceText(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): string {
  const store = getStoreConfig(bill.extra?.store_type ?? settings?.store_type);
  const shopName = settings?.shop_name || APP_NAME;
  const lines = items.map(
    it => `• ${it.item_name}  —  ${it.qty} x ${formatCurrency(it.rate)} = ${formatCurrency(it.total)}`,
  );
  const custLabel = store.customerLabel ?? 'Customer';
  const headerLines = [
    `${shopName} — Invoice ${bill.bill_number}`,
    formatDateTime(bill.created_at),
    `${custLabel}: ${bill.customer_name}`,
    bill.extra?.patient_address ? `Patient Address: ${bill.extra.patient_address}` : '',
    bill.extra?.doctor_name ? `Prescribing Doctor: ${bill.extra.doctor_name}` : '',
    bill.extra?.doctor_address ? `Doctor Address: ${bill.extra.doctor_address}` : '',
  ].filter(Boolean);

  return [
    ...headerLines,
    '',
    ...lines,
    '',
    `Grand Total: ${formatCurrency(bill.total_amount)}`,
  ].join('\n');
}

// Open the system print dialog (the user can print or "Save as PDF").
export async function printInvoice(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): Promise<void> {
  await RNPrint.print({ html: buildInvoiceHtml(bill, items, settings) });
}

// Save the invoice as a PDF. On mobile the OS print sheet is how a PDF is
// exported — it offers "Save to Files" / "Save as PDF" (and AirPrint). This
// mirrors the web app's "Download PDF" action.
export async function downloadInvoicePdf(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): Promise<void> {
  await RNPrint.print({ html: buildInvoiceHtml(bill, items, settings) });
}

// Open the share sheet with the invoice text (send to WhatsApp, etc.).
export async function shareInvoice(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): Promise<void> {
  await Share.open({
    title: `Invoice ${bill.bill_number}`,
    message: buildInvoiceText(bill, items, settings),
  });
}
