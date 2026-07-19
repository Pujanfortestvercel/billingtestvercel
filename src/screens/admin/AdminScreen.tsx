// ---------------------------------------------------------------------------
// ADMIN SCREEN — the app owner's control panel. Lists every BUSINESS account
// that registered. For each one the admin can:
//   • assign a PLAN (21-day trial / 1m / 3m / 6m / 1y / permanent) → the app
//     enforces the expiry date,
//   • Freeze (suspend access),
//   • toggle the Inventory feature on/off,
//   • Delete the account permanently (cascades all their data).
// Admin accounts are hidden from the list.
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { EmptyState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import {
  listAllUsers,
  freezeUser,
  setSubscriptionPlan,
  setUserInventory,
  deleteUserAccount,
  type AdminUserRow,
} from '../../services/adminService';
import {
  computeStatus,
  planLabel,
  PLANS,
  type PlanKey,
} from '../../services/subscriptionService';
import { formatDate } from '../../utils/format';
import { colors, fontSize, radius, spacing } from '../../theme';

export function AdminScreen() {
  const { user, signOut } = useAuth();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await listAllUsers());
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not load accounts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<void>, msg?: string) {
    try {
      await action();
      await load();
      if (msg) Alert.alert('Done', msg);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not update.');
    }
  }

  function confirmDelete(row: AdminUserRow) {
    Alert.alert(
      'Delete account permanently?',
      `This permanently deletes ${row.email ?? 'this account'} and ALL of their data — ` +
        `customers, items, and bills. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserAccount(row.id);
              setRows(prev => prev.filter(r => r.id !== row.id));
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Could not delete the account.');
            }
          },
        },
      ],
    );
  }

  const visibleRows = rows.filter(r => r.role !== 'admin');

  return (
    <ScreenContainer
      title="Admin"
      right={<Button title="Log out" variant="danger" onPress={signOut} style={styles.topBtn} />}
    >
      <Text style={styles.intro}>Assign a plan to approve, freeze to suspend, or delete an account.</Text>
      <Text style={styles.me}>You: {user?.email}</Text>

      {loading ? (
        <Loading />
      ) : visibleRows.length === 0 ? (
        <EmptyState emoji="🧑‍💼" title="No accounts yet" subtitle="When a business registers, they'll appear here." />
      ) : (
        <FlatList
          data={visibleRows}
          keyExtractor={r => r.id}
          renderItem={({ item }) => (
            <AdminRow
              row={item}
              onApplyPlan={(plan, label) => run(() => setSubscriptionPlan(item.id, plan), `Plan set: ${label}`)}
              onFreeze={() => run(() => freezeUser(item.id), 'Account suspended.')}
              onToggleInventory={enabled =>
                run(() => setUserInventory(item.id, enabled), enabled ? 'Inventory enabled.' : 'Inventory disabled.')
              }
              onDelete={() => confirmDelete(item)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </ScreenContainer>
  );
}

function AdminRow({
  row,
  onApplyPlan,
  onFreeze,
  onToggleInventory,
  onDelete,
}: {
  row: AdminUserRow;
  onApplyPlan: (plan: PlanKey, label: string) => void;
  onFreeze: () => void;
  onToggleInventory: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const { status, daysLeft } = computeStatus(row.subscription);
  // Default to the current plan, else trial. Clamp to a known key so a
  // legacy/unknown stored plan can't leave the selection unmatched.
  const [plan, setPlan] = useState<PlanKey>(
    PLANS.some(p => p.key === row.subscription?.plan)
      ? (row.subscription!.plan as PlanKey)
      : 'trial',
  );

  const badge =
    status === 'frozen'
      ? { label: 'FROZEN', color: colors.danger }
      : status === 'trial'
      ? { label: `TRIAL · ${daysLeft}d left`, color: colors.success }
      : status === 'active'
      ? daysLeft === -1
        ? { label: 'PERMANENT', color: colors.success }
        : { label: `ACTIVE · ${daysLeft}d left`, color: colors.success }
      : { label: 'EXPIRED', color: colors.warning };

  const end = row.subscription?.trial_end;
  const inventoryOn = !!row.subscription?.inventory_enabled;

  return (
    <Card>
      <Text style={styles.email}>{row.email ?? '(no email)'}</Text>
      <Text style={[styles.status, { color: badge.color }]}>{badge.label}</Text>
      <Text style={styles.dates}>
        Joined {formatDate(row.created_at)} · Plan: {planLabel(row.subscription?.plan)}
        {status !== 'frozen' && status !== 'expired' && daysLeft !== -1 && end
          ? ` · ends ${formatDate(end)}`
          : ''}
      </Text>

      {/* Plan chips */}
      <Text style={styles.pickLabel}>Assign plan</Text>
      <View style={styles.chips}>
        {PLANS.map(p => {
          const active = p.key === plan;
          return (
            <Pressable
              key={p.key}
              onPress={() => setPlan(p.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button
          title="Apply plan"
          onPress={() => {
            const p = PLANS.find(x => x.key === plan);
            if (p) onApplyPlan(plan, p.label);
          }}
          style={styles.actionBtn}
        />
        <Button title="Freeze" variant="danger" onPress={onFreeze} style={styles.actionBtn} />
      </View>
      <View style={styles.actions}>
        <Button
          title={inventoryOn ? '📦 Inventory: On' : '📦 Inventory: Off'}
          variant={inventoryOn ? 'primary' : 'ghost'}
          onPress={() => onToggleInventory(!inventoryOn)}
          style={styles.actionBtn}
        />
        <Button title="🗑 Delete" variant="danger" onPress={onDelete} style={styles.actionBtn} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  topBtn: { height: 38, paddingHorizontal: spacing.md },
  intro: { fontSize: fontSize.md, color: colors.text, fontWeight: '600' },
  me: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.sm },
  listContent: { paddingBottom: spacing.xl },
  email: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  status: { fontWeight: '800', fontSize: fontSize.sm, marginTop: spacing.xs },
  dates: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2, marginBottom: spacing.sm },
  pickLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600', marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  chipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.primary, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flex: 1, height: 44 },
});
