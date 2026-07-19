// ---------------------------------------------------------------------------
// FORMATTING HELPERS — turn raw numbers/dates into nice display strings.
// ---------------------------------------------------------------------------

// Money: 1234.5 → "₹1234.50". Change the symbol if you don't use Rupees.
export function formatCurrency(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return '₹' + n.toFixed(2);
}

// Safely turn text from an input box into a number ("" → 0, "abc" → 0).
export function toNumber(text: string): number {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

// Date: "2026-06-13T..." → "13 Jun 2026".
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Date + time: → "13 Jun 2026, 6:44 PM".
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    formatDate(iso) +
    ', ' +
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
}

// A simple key used to GROUP bills by calendar day in the History screen.
export function dayLabel(iso: string): string {
  return new Date(iso).toDateString(); // e.g. "Sat Jun 13 2026"
}
