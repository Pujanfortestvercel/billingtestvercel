// ---------------------------------------------------------------------------
// BILL HISTORY — paginated list (newest first), grouped by day, searchable by
// customer AND filterable by date range. Click a bill to expand → items +
// Edit / Print / Share / Delete. "Delete all" in the header.
// Date filter is always visible for medical/pharmacy (drug inspector audits).
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, Spinner } from '../components/UI';
import {
  deleteAllBills,
  deleteBill,
  fetchBillsPage,
  getBillItems,
} from '../services/billService';
import { printInvoice, downloadInvoicePdf, shareInvoice } from '../utils/invoice';
import type { Bill, BillItem } from '../types/models';
import { formatCurrency, formatDateTime, dayLabel } from '../utils/format';

const PAGE = 20;

export function HistoryPage() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);

  // Date filter — single date
  const [filterDate, setFilterDate] = useState('');
  const isMedical = settings?.store_type === 'medical';

  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, BillItem[]>>({});
  // Which invoice action is in flight, e.g. "pdf:<billId>" / "print:<billId>".
  const [busy, setBusy] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchBillsPage({
        search: debounced,
        fromDate: filterDate || undefined,
        toDate: filterDate || undefined,
        limit: PAGE,
        offset: 0,
      });
      setBills(page);
      setHasMore(page.length === PAGE);
    } catch (e: any) {
      toast(e?.message ?? 'Could not load bills.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debounced, filterDate, toast]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  async function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchBillsPage({
        search: debounced,
        fromDate: filterDate || undefined,
        toDate: filterDate || undefined,
        limit: PAGE,
        offset: bills.length,
      });
      setBills(prev => [...prev, ...page]);
      setHasMore(page.length === PAGE);
    } finally {
      setLoadingMore(false);
    }
  }

  function clearDateFilter() {
    setFilterDate('');
  }

  async function toggleExpand(bill: Bill) {
    if (expandedId === bill.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(bill.id);
    if (!itemsCache[bill.id]) {
      try {
        const items = await getBillItems(bill.id);
        setItemsCache(prev => ({ ...prev, [bill.id]: items }));
      } catch (e: any) {
        toast(e?.message ?? 'Could not load bill items.', 'error');
      }
    }
  }

  async function doPrint(bill: Bill) {
    if (busy) return;
    setBusy(`print:${bill.id}`);
    try {
      const items = itemsCache[bill.id] ?? (await getBillItems(bill.id));
      await printInvoice(bill, items, settings);
    } catch (e: any) {
      if (e?.message) toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function doPdf(bill: Bill) {
    if (busy) return;
    setBusy(`pdf:${bill.id}`);
    try {
      const items = itemsCache[bill.id] ?? (await getBillItems(bill.id));
      await downloadInvoicePdf(bill, items, settings);
    } catch (e: any) {
      toast(e?.message ?? 'Could not generate PDF.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function doShare(bill: Bill) {
    try {
      const items = itemsCache[bill.id] ?? (await getBillItems(bill.id));
      await shareInvoice(bill, items, settings);
    } catch (e: any) {
      // A cancelled native/web share throws AbortError — that's not an error.
      if (e?.name !== 'AbortError') toast(e?.message ?? 'Could not share.', 'error');
    }
  }

  async function remove(bill: Bill) {
    if (isMedical) {
      toast('Regulations require pharmacies to preserve all bill history.', 'error');
      return;
    }
    if (!(await confirm('Delete bill', `Delete bill ${bill.bill_number}?`, { danger: true }))) return;
    try {
      await deleteBill(bill.id);
      setBills(prev => prev.filter(b => b.id !== bill.id));
      toast('Bill deleted.', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Could not delete.', 'error');
    }
  }

  async function removeAll() {
    if (isMedical) {
      toast('Regulations require pharmacies to preserve all bill history.', 'error');
      return;
    }
    if (!user || bills.length === 0) return;
    if (!(await confirm('Delete ALL bills', 'This permanently deletes every bill. Continue?', { danger: true }))) return;
    try {
      await deleteAllBills(user.id);
      setBills([]);
      toast('All bills deleted.', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Could not delete.', 'error');
    }
  }

  const hasDateFilter = !!filterDate;

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Bill History</h1>
        {bills.length > 0 && !isMedical ? (
          <Button title="Delete all" variant="danger" small onClick={removeAll} />
        ) : null}
      </div>

      <div className="row gap-sm" style={{ marginBottom: 16, alignItems: 'center' }}>
        <input
          className="input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by customer name…"
          style={{ flex: 1, margin: 0 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', whiteSpace: 'nowrap' }}>
            📅 Date:
          </span>
          <input
            type="date"
            className="input"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            style={{ width: 160, padding: '8px 10px', margin: 0 }}
          />
          {hasDateFilter && (
            <Button title="✕" variant="ghost" small onClick={clearDateFilter} />
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : bills.length === 0 ? (
        <EmptyState
          emoji="🗂️"
          title={debounced || hasDateFilter ? 'No matches' : 'No bills yet'}
          subtitle={
            debounced || hasDateFilter
              ? 'Try a different search or date range.'
              : 'Create one from the New Bill page.'
          }
        />
      ) : (
        <>
          {bills.map((bill, index) => {
            const showDay =
              index === 0 ||
              dayLabel(bills[index - 1].created_at) !== dayLabel(bill.created_at);
            const expanded = expandedId === bill.id;
            const items = itemsCache[bill.id];
            return (
              <div key={bill.id}>
                {showDay ? (
                  <div
                    className="muted"
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      margin: '18px 2px 8px',
                    }}
                  >
                    {dayLabel(bill.created_at)}
                  </div>
                ) : null}

                <Card onClick={() => toggleExpand(bill)}>
                  <div className="row spread">
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: 17 }}>{bill.customer_name}</strong>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {bill.bill_number} · {formatDateTime(bill.created_at)}
                      </div>
                    </div>
                    <strong style={{ fontSize: 18, color: 'var(--primary)' }}>
                      {formatCurrency(bill.total_amount)}
                    </strong>
                  </div>

                  {expanded ? (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      {!items ? (
                        <Spinner />
                      ) : (
                        <>
                          {items.map(li => (
                            <div key={li.id} className="row spread" style={{ padding: '4px 0' }}>
                              <span>{li.item_name}</span>
                              <span className="muted">
                                {li.qty} × {formatCurrency(li.rate)} = {formatCurrency(li.total)}
                              </span>
                            </div>
                          ))}
                          <div className="row gap-sm" style={{ flexWrap: 'wrap', marginTop: 12 }}>
                            <Button title="Edit" variant="ghost" small onClick={() => navigate(`/billing?billId=${bill.id}`)} />
                            <Button title="🖨️ Print" variant="ghost" small loading={busy === `print:${bill.id}`} disabled={!!busy} onClick={() => doPrint(bill)} />
                            <Button title="📄 Download PDF" variant="ghost" small loading={busy === `pdf:${bill.id}`} disabled={!!busy} onClick={() => doPdf(bill)} />
                            <Button title="💬 Share" variant="ghost" small onClick={() => doShare(bill)} />
                            <Button title="Delete" variant="danger" small onClick={() => remove(bill)} />
                          </div>
                        </>
                      )}
                    </div>
                  ) : null}
                </Card>
              </div>
            );
          })}
          {hasMore ? (
            <div style={{ marginTop: 14 }}>
              <Button title="Load more" variant="ghost" block loading={loadingMore} onClick={loadMore} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
