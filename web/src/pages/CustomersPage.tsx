// ---------------------------------------------------------------------------
// CUSTOMERS — search + paginated list (load more), add/edit modal, freeze/
// unfreeze, delete. Web port of the original CustomersScreen.
// ---------------------------------------------------------------------------
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useToast } from '../components/Toast';
import { Button, Card, EmptyState, Modal, Spinner, TextField } from '../components/UI';
import {
  createCustomer,
  deleteCustomer,
  fetchCustomersPage,
  setFrozen,
  updateCustomerName,
} from '../services/customerService';
import type { Customer } from '../types/models';

const PAGE = 30;

export function CustomersPage() {
  const { user } = useAuth();
  const { toast, confirm } = useToast();
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);

  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const page = await fetchCustomersPage({ search: debounced, limit: PAGE, offset: 0 });
      setItems(page);
      setHasMore(page.length === PAGE);
    } catch (e: any) {
      toast(e?.message ?? 'Could not load customers.', 'error');
    } finally {
      setLoading(false);
    }
  }, [debounced, toast]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  async function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchCustomersPage({ search: debounced, limit: PAGE, offset: items.length });
      setItems(prev => [...prev, ...page]);
      setHasMore(page.length === PAGE);
    } finally {
      setLoadingMore(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setNameInput('');
    setModalOpen(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setNameInput(c.customer_name);
    setModalOpen(true);
  }

  async function save() {
    const name = nameInput.trim();
    if (!name || !user) return;
    setSaving(true);
    try {
      if (editing) await updateCustomerName(editing.id, name);
      else await createCustomer(user.id, name);
      setModalOpen(false);
      toast(editing ? 'Customer updated.' : 'Customer added.', 'success');
      loadFirst();
    } catch (e: any) {
      toast(e?.message ?? 'Could not save.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleFreeze(c: Customer) {
    try {
      await setFrozen(c.id, !c.is_frozen);
      setItems(prev => prev.map(x => (x.id === c.id ? { ...x, is_frozen: !c.is_frozen } : x)));
    } catch (e: any) {
      toast(e?.message ?? 'Could not update.', 'error');
    }
  }

  async function remove(c: Customer) {
    if (!(await confirm('Delete customer', `Delete "${c.customer_name}"?`, { danger: true }))) return;
    try {
      await deleteCustomer(c.id);
      setItems(prev => prev.filter(x => x.id !== c.id));
      toast('Customer deleted.', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Could not delete.', 'error');
    }
  }

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Customers</h1>
        <Button title="+ Add customer" onClick={openAdd} />
      </div>

      <input
        className="input"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search customers…"
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="👥"
          title={debounced ? 'No matches' : 'No customers yet'}
          subtitle={debounced ? 'Try a different search.' : 'Add your first customer to get started.'}
          actionLabel={debounced ? undefined : 'Add customer'}
          onAction={debounced ? undefined : openAdd}
        />
      ) : (
        <>
          {items.map(c => (
            <Card key={c.id}>
              <div className="row spread" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div className="row gap-sm">
                  <strong style={{ fontSize: 17 }}>{c.customer_name}</strong>
                  {c.is_frozen ? <span className="badge badge-danger">Frozen</span> : null}
                </div>
                <div className="row gap-sm">
                  <Button
                    title={c.is_frozen ? 'Unfreeze' : 'Freeze'}
                    variant={c.is_frozen ? 'secondary' : 'ghost'}
                    small
                    onClick={() => toggleFreeze(c)}
                  />
                  <Button title="Edit" variant="ghost" small onClick={() => openEdit(c)} />
                  <Button title="Delete" variant="danger" small onClick={() => remove(c)} />
                </div>
              </div>
            </Card>
          ))}
          {hasMore ? (
            <div style={{ marginTop: 14 }}>
              <Button title="Load more" variant="ghost" block loading={loadingMore} onClick={loadMore} />
            </div>
          ) : null}
        </>
      )}

      <Modal open={modalOpen} title={editing ? 'Edit customer' : 'New customer'} onClose={() => setModalOpen(false)}>
        <TextField
          label="Customer name"
          value={nameInput}
          autoFocus
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="e.g. Acme Traders"
        />
        <div className="row gap-sm" style={{ marginTop: 8 }}>
          <Button title="Cancel" variant="ghost" block onClick={() => setModalOpen(false)} />
          <Button title="Save" block loading={saving} onClick={save} />
        </div>
      </Modal>
    </div>
  );
}
