// ---------------------------------------------------------------------------
// INVOICE (web) — build a printable, store-aware invoice with the shop's
// profile header (logo, name, phone, address), store-specific columns
// (batch/expiry, size/HSN, serial/warranty…), and a full discount/tax
// breakdown. Then PRINT (browser dialog), DOWNLOAD as a real PDF, or SHARE.
// ---------------------------------------------------------------------------
import html2pdf from 'html2pdf.js';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Turn a bill number into a filesystem-safe PDF filename (strips slashes,
// spaces, and anything that would break a download name or native file path).
function safeFileName(billNumber?: string): string {
  const base =
    String(billNumber || 'invoice')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'invoice';
  return `${base}.pdf`;
}

// The invoice markup (inline-styled, self-contained — no app CSS needed).
export function invoiceInnerHtml(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): string {
  const store = getStoreConfig(bill.extra?.store_type ?? settings?.store_type);
  const presentMeta = META_ORDER.filter(k =>
    items.some(it => it.meta && it.meta[k]),
  );
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
      const metaCells = presentMeta
        .map(k => `<td>${esc(it.meta?.[k] ?? '—')}</td>`)
        .join('');
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
      ? `<tr><td>Discount (${bill.extra?.discount_percent ?? 0}%)</td><td class="num">– ${formatCurrency(discount)}</td></tr>`
      : '',
    serviceCharge > 0
      ? `<tr><td>Service charge (${bill.extra?.service_charge_percent ?? 0}%)</td><td class="num">+ ${formatCurrency(serviceCharge)}</td></tr>`
      : '',
    tax > 0
      ? `<tr><td>Tax / GST (${bill.tax_percent ?? 0}%)</td><td class="num">+ ${formatCurrency(tax)}</td></tr>`
      : '',
    `<tr class="grand"><td>Grand Total</td><td class="num">${formatCurrency(bill.total_amount)}</td></tr>`,
  ].join('');

  const shopName = settings?.shop_name || APP_NAME;
  const isDataUrl = settings?.logo_url?.startsWith('data:');
  const crossAttr = isDataUrl ? '' : ' crossorigin="anonymous"';
  const logo = settings?.logo_url
    ? `<img src="${esc(settings.logo_url)}"${crossAttr} style="width:54px;height:54px;border-radius:8px;object-fit:cover" />`
    : `<div style="font-size:42px">${store.emoji}</div>`;
  const contact = [settings?.phone, settings?.address]
    .filter(Boolean)
    .map(x => esc(String(x)))
    .join(' · ');

  const orderMeta = [
    bill.extra?.table_no ? `Table: ${esc(String(bill.extra.table_no))}` : '',
    bill.extra?.order_type ? `(${esc(String(bill.extra.order_type))})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `
  <div class="inv">
    <style>
      .inv { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color:#111827; }
      .inv h1 { margin:0; font-size:24px; color:#2563EB; }
      .inv .muted { color:#6B7280; font-size:13px; }
      .inv .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #2563EB; padding-bottom:16px; }
      .inv table { width:100%; border-collapse:collapse; margin-top:20px; }
      .inv th, .inv td { text-align:left; padding:9px 8px; border-bottom:1px solid #E5E7EB; font-size:13px; }
      .inv th { background:#F3F4F6; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#6B7280; }
      .inv .num { text-align:right; }
      .inv .totals { margin-top:18px; margin-left:auto; width:300px; }
      .inv .totals td { border:none; padding:5px 8px; }
      .inv .totals .grand td { border-top:2px solid #111827; font-size:17px; font-weight:800; padding-top:10px; }
      .inv .foot { margin-top:30px; text-align:center; color:#9CA3AF; font-size:12px; }
      .inv .notes { margin-top:16px; font-size:13px; color:#374151; }
    </style>
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

    <div style="margin-top:16px;font-size:14px">
      <strong>${esc(store.customerLabel ? store.customerLabel + ':' : 'Billed to:')}</strong> ${esc(bill.customer_name)}
      ${bill.extra?.patient_address ? `<div class="muted">Address: ${esc(String(bill.extra.patient_address))}</div>` : ''}
      ${bill.extra?.doctor_name ? `<div class="muted" style="margin-top:4px"><strong>Dr. Name:</strong> ${esc(String(bill.extra.doctor_name))}${bill.extra?.doctor_address ? ` (${esc(String(bill.extra.doctor_address))})` : ''}</div>` : ''}
    </div>

    <table>
      <thead><tr>${headCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>

    <table class="totals">${breakdown}</table>

    ${bill.extra?.notes ? `<div class="notes"><strong>Notes:</strong> ${esc(String(bill.extra.notes))}</div>` : ''}

    <div class="foot">Thank you for your business · Generated by ${esc(shopName)}</div>
  </div>`;
}

function fullDoc(inner: string, title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>${esc(title)}</title>
    <style>body{margin:0;padding:40px;max-width:820px;margin:0 auto}@media print{body{padding:0}}</style>
    </head><body>${inner}</body></html>`;
}

const isNative = () => Capacitor.isNativePlatform();

function pdfWorker(fileName: string) {
  return html2pdf()
    .set({
      margin: 10,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      // Keep table rows from being sliced across page boundaries.
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    });
}

// Build the PDF and return its raw base64 (no data-URI prefix) — used on
// native, where we hand the bytes to the Filesystem/Share plugins.
async function invoicePdfBase64(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): Promise<string> {
  const fileName = safeFileName(bill.bill_number);
  const htmlInner = invoiceInnerHtml(bill, items, settings);
  const html = fullDoc(htmlInner, bill.bill_number);
  const dataUri = (await pdfWorker(fileName).from(html).outputPdf('datauristring')) as string;
  const comma = dataUri.indexOf('base64,');
  return comma >= 0 ? dataUri.slice(comma + 'base64,'.length) : dataUri;
}

// On native devices, write the PDF to disk and open the standard share sheet.
async function sharePdfNative(
  bill: Bill,
  items: BillItem[],
  settings: Settings | null,
  dialogTitle: string,
): Promise<void> {
  const base64 = await invoicePdfBase64(bill, items, settings);
  const fileName = safeFileName(bill.bill_number);
  const writeRes = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: dialogTitle,
    text: `Invoice ${bill.bill_number} for ${bill.customer_name}`,
    url: writeRes.uri,
  });
}

// PRINT — browser print dialog on the web; on native (Android/iOS WebView there
// is no print dialog) fall back to the PDF + native share/print sheet.
export async function printInvoice(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): Promise<void> {
  const htmlInner = invoiceInnerHtml(bill, items, settings);
  if (isNative()) {
    await sharePdfNative(bill, items, settings ?? null, 'Print invoice');
    return;
  }
  const html = fullDoc(htmlInner, bill.bill_number);
  await new Promise<void>((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      // Defer removal so the browser isn't torn down mid print-dialog.
      setTimeout(() => iframe.remove(), 1000);
      resolve();
    };

    // Attach the load handler BEFORE the document exists, so the load event
    // cannot fire before we're listening (the old doc.write race).
    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        iframe.remove();
        reject(new Error('Could not open the print view.'));
        return;
      }
      win.onafterprint = finish;
      try {
        win.focus();
        win.print();
      } catch (e) {
        iframe.remove();
        reject(e as Error);
        return;
      }
      // Safety net for browsers that never fire afterprint.
      setTimeout(finish, 60000);
    };

    // srcdoc lets the browser own the document lifecycle → reliable onload.
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });
}

// Generate a real PDF. On the web this downloads the file directly; on native
// the browser download API is unavailable, so we save it and open the share/
// print sheet instead.
export async function downloadInvoicePdf(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): Promise<void> {
  if (isNative()) {
    await sharePdfNative(bill, items, settings ?? null, 'Save or share invoice');
    return;
  }
  const fileName = safeFileName(bill.bill_number);
  const htmlInner = invoiceInnerHtml(bill, items, settings);
  const html = fullDoc(htmlInner, bill.bill_number);
  try {
    await pdfWorker(fileName).from(html).save();
    console.log('[downloadInvoicePdf] Save complete');
  } catch (err) {
    console.error('[downloadInvoicePdf] Error occurred:', err);
    // A remote logo that can't be fetched (CORS) can break rasterisation.
    // Retry once without it so the invoice still downloads.
    if (!settings?.logo_url) throw err;
    const htmlInner2 = invoiceInnerHtml(bill, items, { ...settings, logo_url: null });
    const html2 = fullDoc(htmlInner2, bill.bill_number);
    await pdfWorker(fileName).from(html2).save();
  }
}

// A plain-text version for sharing as a message (WhatsApp, SMS, etc.).
export function buildInvoiceText(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): string {
  const shopName = settings?.shop_name || APP_NAME;
  const lines = items.map(
    it => `• ${it.item_name}  —  ${it.qty} x ${formatCurrency(it.rate)} = ${formatCurrency(it.total)}`,
  );
  return [
    `${shopName} — Invoice ${bill.bill_number}`,
    formatDateTime(bill.created_at),
    `Customer: ${bill.customer_name}`,
    '',
    ...lines,
    '',
    `Grand Total: ${formatCurrency(bill.total_amount)}`,
  ].join('\n');
}

// Share the invoice: native share sheet if supported, else open WhatsApp.
export async function shareInvoice(
  bill: Bill,
  items: BillItem[],
  settings?: Settings | null,
): Promise<void> {
  const text = buildInvoiceText(bill, items, settings);

  // Native: use the Capacitor Share plugin (WebView has no navigator.share).
  if (isNative()) {
    await Share.share({ title: `Invoice ${bill.bill_number}`, text });
    return;
  }

  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string }) => Promise<void>;
  };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title: `Invoice ${bill.bill_number}`, text });
      return;
    } catch {
      /* fall through to WhatsApp */
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}
