// ---------------------------------------------------------------------------
// BILL VALIDATION — collects EVERY problem so they can be shown together in
// ONE popup (instead of annoying the user with one error at a time).
// ---------------------------------------------------------------------------

// One billing row as it exists on screen (values are still raw text strings).
export type RowForValidation = {
  item_name: string;
  qty: string;
  rate: string;
};

export type ValidateBillParams = {
  customerName: string;
  rows: RowForValidation[];
  isFrozen: boolean; // is the chosen customer frozen?
  isSubscriptionActive: boolean; // trial/subscription still valid?
};

// Returns a list of human-readable error messages. Empty list = all good.
export function validateBill(params: ValidateBillParams): string[] {
  const errors: string[] = [];

  if (!params.isSubscriptionActive) {
    errors.push('Your trial / subscription has expired.');
  }
  if (params.isFrozen) {
    errors.push('This customer account is frozen and cannot be billed.');
  }
  if (!params.customerName.trim()) {
    errors.push('Customer name is empty.');
  }

  // A row "counts" if the user typed anything in it. Fully-empty rows are
  // ignored (they're just spare rows).
  const touchedRows = params.rows.filter(
    r => r.item_name.trim() || r.qty.trim() || r.rate.trim(),
  );
  if (touchedRows.length === 0) {
    errors.push('Add at least one item.');
  }

  params.rows.forEach((row, index) => {
    const hasName = !!row.item_name.trim();
    const hasQty = !!row.qty.trim();
    const hasRate = !!row.rate.trim();
    const touched = hasName || hasQty || hasRate;
    if (!touched) return; // skip empty spare rows

    const n = index + 1;
    if (!hasName) errors.push(`Row ${n}: Item name is empty.`);

    if (!hasQty) {
      errors.push(`Row ${n}: Qty is empty.`);
    } else if (!Number.isFinite(Number(row.qty)) || Number(row.qty) <= 0) {
      // Number.isFinite rejects NaN AND Infinity ("1e999", "Infinity"), which
      // would otherwise pass and blow the bill total up to Infinity.
      errors.push(`Row ${n}: Qty must be a number greater than 0.`);
    }

    if (!hasRate) {
      errors.push(`Row ${n}: Rate is empty.`);
    } else if (!Number.isFinite(Number(row.rate)) || Number(row.rate) < 0) {
      errors.push(`Row ${n}: Rate must be a valid number.`);
    }
  });

  return errors;
}
