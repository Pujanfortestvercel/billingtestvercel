// ---------------------------------------------------------------------------
// FORMATTING HELPERS — turn raw numbers/dates into nice display strings.
// ---------------------------------------------------------------------------

// Money: 1234.5 → "₹1234.50". Change the symbol if you don't use Rupees.
export function formatCurrency(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return '₹' + n.toFixed(2);
}

// Safely turn text from an input box into a number ("" → 0, "abc" → 0).
// Uses Number() (not parseFloat) so this agrees with validateBill's Number()
// check — parseFloat's prefix parsing ("12abc" → 12, "1,000" → 1) would let a
// value pass validation but save a different number.
export function toNumber(text: string): number {
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

// Date: "2026-06-13T..." → "13 Jun 2026". Missing/invalid input → "—".
export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Date + time: → "13 Jun 2026, 6:44 PM". Missing/invalid input → "—".
export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    formatDate(iso) +
    ', ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

// A simple key used to GROUP bills by calendar day in the History screen.
export function dayLabel(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toDateString(); // e.g. "Sat Jun 13 2026"
}
