// ---------------------------------------------------------------------------
// DASHBOARD — home screen: welcome, subscription/renewal status, KPI cards, a
// 7-day revenue bar chart, a recent-bills feed, plus expiry (medical) and
// low-stock (inventory) reminder cards. Entry points to Settings + Inventory.
// ---------------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Loading } from '../../components/common/Loading';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { useSettings } from '../../context/SettingsContext';
import {
  getDashboardStats,
  type DashboardStats,
} from '../../services/analyticsService';
import { getExpiringBatches, type ExpiringLine } from '../../services/billService';
import { listLowStock } from '../../services/inventoryService';
import type { Item } from '../../types/models';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { colors, fontSize, radius, spacing } from '../../theme';

export function DashboardScreen() {
  const { user, signOut } = useAuth();
  const {
    status,
    daysLeft,
    loading: subLoading,
    inventoryEnabled,
  } = useSubscription();
  const { store, settings } = useSettings();
  const navigation = useNavigation<any>();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState<ExpiringLine[]>([]);
  const [lowStock, setLowStock] = useState<Item[]>([]);

  const handleOpenPharmarack = async () => {
    const packageId = 'com.growthaccel.pharmarack_retailer.pharmarack_retailer';
    const playStoreUrl = `https://play.google.com/store/apps/details?id=${packageId}`;
    try {
      const intentUrl = `intent://#Intent;package=${packageId};end`;
      const supported = await Linking.canOpenURL(intentUrl);
      if (supported) {
        await Linking.openURL(intentUrl);
      } else {
        await Linking.openURL(playStoreUrl);
      }
    } catch {
      await Linking.openURL(playStoreUrl);
    }
  };

  const loadStats = useCallback(async () => {
    try {
      setStats(await getDashboardStats());
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!store.expiryAlerts) {
      setExpiring([]);
      return;
    }
    getExpiringBatches(60)
      .then(setExpiring)
      .catch(() => setExpiring([]));
  }, [store.expiryAlerts]);

  useEffect(() => {
    if (!inventoryEnabled) {
      setLowStock([]);
      return;
    }
    listLowStock()
      .then(setLowStock)
      .catch(() => setLowStock([]));
  }, [inventoryEnabled]);

  const daysToExpiry = (iso: string) =>
    Math.ceil((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000);

  const maxDay = stats ? Math.max(1, ...stats.last7.map(d => d.total)) : 1;

  // Renewal messaging (matches the web banner): expired, or ending within 2 days.
  const renewalBanner =
    status === 'expired'
      ? { text: '⛔ Your subscription has expired — billing is disabled. Contact your admin to renew.', danger: true }
      : (status === 'trial' || status === 'active') && daysLeft !== -1 && daysLeft <= 2
      ? {
          text: `⏰ Your subscription ends ${
            daysLeft <= 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`
          } — please contact your admin to renew.`,
          danger: false,
        }
      : null;

  const subLine = subLoading
    ? 'Checking…'
    : status === 'active'
    ? daysLeft === -1
      ? 'Active ✓ (permanent)'
      : `Subscribed — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
    : status === 'trial'
    ? `Free trial — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left`
    : 'Expired — please contact admin to renew';

  return (
    <ScreenContainer
      title="Dashboard"
      scroll
      right={
        <Button
          title="⚙️"
          variant="ghost"
          onPress={() => navigation.navigate('Settings')}
          style={styles.gear}
        />
      }
    >
      {/* Shop branding — logo + name + store type (mirrors the web sidebar). */}
      <View style={styles.brandRow}>
        {settings?.logo_url ? (
          <Image source={{ uri: settings.logo_url }} style={styles.brandLogo} resizeMode="cover" />
        ) : (
          <View style={styles.brandEmojiBox}>
            <Text style={styles.brandEmoji}>{store.emoji}</Text>
          </View>
        )}
        <View style={styles.brandText}>
          <Text style={styles.brandName} numberOfLines={1}>
            {settings?.shop_name || 'BillingApp'}
          </Text>
          <Text style={styles.brandStore} numberOfLines={1}>
            {store.label}
          </Text>
        </View>
      </View>

      <Text style={styles.welcome}>Welcome back, {user?.email}</Text>

      {/* Renewal / expiry banner */}
      {renewalBanner ? (
        <View style={[styles.banner, renewalBanner.danger ? styles.bannerDanger : styles.bannerWarn]}>
          <Text style={[styles.bannerText, renewalBanner.danger ? styles.dangerText : styles.warnText]}>
            {renewalBanner.text}
          </Text>
        </View>
      ) : null}

      {/* Subscription card */}
      <Card>
        <Text style={styles.kpiLabel}>Subscription</Text>
        <Text
          style={[
            styles.subValue,
            status === 'expired' ? styles.dangerText : styles.successText,
          ]}
        >
          {subLine}
        </Text>
        <Button
          title="🧾  Create new bill"
          onPress={() => navigation.navigate('Billing')}
          style={styles.newBill}
        />
        {store.key === 'medical' ? (
          <Button
            title="💊  Open Pharmarack"
            variant="ghost"
            onPress={handleOpenPharmarack}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </Card>

      {/* Expiry reminders (medical stores) */}
      {store.expiryAlerts && expiring.length > 0 ? (
        <Card style={styles.warnCard}>
          <View style={styles.rowSpread}>
            <Text style={styles.cardHeading}>⏰ Expiry reminders</Text>
            <Text style={styles.badgeWarn}>{expiring.length}</Text>
          </View>
          <Text style={styles.muted}>Batches sold that are expired or expiring within 60 days.</Text>
          {expiring.slice(0, 6).map(e => {
            const d = daysToExpiry(e.expiry_date);
            return (
              <View key={e.id} style={styles.feedRow}>
                <View style={styles.feedInfo}>
                  <Text style={styles.feedName} numberOfLines={1}>
                    {e.item_name}
                    {e.batch_no ? `  · batch ${e.batch_no}` : ''}
                  </Text>
                  <Text style={styles.feedMeta} numberOfLines={1}>
                    {e.bill_number} · {e.customer_name}
                  </Text>
                </View>
                <Text style={[styles.feedRight, d < 0 ? styles.dangerText : styles.warnText]}>
                  {d < 0 ? `expired ${Math.abs(d)}d ago` : `in ${d}d`}
                </Text>
              </View>
            );
          })}
          {expiring.length > 6 ? (
            <Text style={styles.moreText}>+ {expiring.length - 6} more…</Text>
          ) : null}
        </Card>
      ) : null}

      {/* Low-stock reminders (inventory enabled) */}
      {inventoryEnabled && lowStock.length > 0 ? (
        <Card style={styles.dangerCard}>
          <View style={styles.rowSpread}>
            <Text style={styles.cardHeading}>📦 Low stock</Text>
            <Text style={styles.badgeDanger}>{lowStock.length}</Text>
          </View>
          <Text style={styles.muted}>Items at or below their reorder level.</Text>
          {lowStock.slice(0, 6).map(it => (
            <View key={it.id} style={styles.feedRow}>
              <Text style={styles.feedName} numberOfLines={1}>
                {it.item_name}
              </Text>
              <Text style={styles.feedRight}>
                {it.stock_qty ?? 0} left
                <Text style={styles.muted}> · reorder at {it.reorder_level ?? 0}</Text>
              </Text>
            </View>
          ))}
          <Button
            title="Open inventory"
            variant="ghost"
            onPress={() => navigation.navigate('Inventory')}
            style={styles.inlineBtn}
          />
        </Card>
      ) : null}

      {/* Inventory entry point when enabled but nothing low */}
      {inventoryEnabled && lowStock.length === 0 ? (
        <Button
          title="📊  Open inventory"
          variant="ghost"
          onPress={() => navigation.navigate('Inventory')}
          style={styles.inventoryBtn}
        />
      ) : null}

      {loading ? (
        <Loading text="Loading your numbers…" />
      ) : stats ? (
        <>
          {/* KPI cards */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpi, styles.kpiAccent]}>
              <Text style={styles.kpiLabelAccent}>Revenue (total)</Text>
              <Text style={styles.kpiValueAccent}>{formatCurrency(stats.revenueTotal)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>This month</Text>
              <Text style={styles.kpiValue}>{formatCurrency(stats.revenueThisMonth)}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Bills</Text>
              <Text style={styles.kpiValue}>{stats.bills}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Customers</Text>
              <Text style={styles.kpiValue}>{stats.customers}</Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Items</Text>
              <Text style={styles.kpiValue}>{stats.items}</Text>
            </View>
          </View>

          {/* 7-day chart */}
          <Card>
            <Text style={styles.cardHeading}>Last 7 days</Text>
            <View style={styles.chart}>
              {stats.last7.map((d, i) => (
                <View key={i} style={styles.barCol}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(4, (d.total / maxDay) * 120),
                        backgroundColor: d.total > 0 ? colors.primary : colors.border,
                      },
                    ]}
                  />
                  <Text style={styles.barLabel}>{d.label}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Recent bills */}
          <Card>
            <Text style={styles.cardHeading}>Recent bills</Text>
            {stats.recent.length === 0 ? (
              <Text style={styles.muted}>No bills yet — create your first one.</Text>
            ) : (
              stats.recent.map(b => (
                <View key={b.id} style={styles.feedRow}>
                  <View style={styles.feedInfo}>
                    <Text style={styles.feedName} numberOfLines={1}>
                      {b.customer_name}
                    </Text>
                    <Text style={styles.feedMeta} numberOfLines={1}>
                      {b.bill_number} · {formatDateTime(b.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.feedAmount}>{formatCurrency(b.total_amount)}</Text>
                </View>
              ))
            )}
            <Button
              title="View all history"
              variant="ghost"
              onPress={() => navigation.navigate('History')}
              style={styles.inlineBtn}
            />
          </Card>
        </>
      ) : (
        <Card>
          <Text style={styles.muted}>Could not load dashboard data.</Text>
        </Card>
      )}

      <Button title="Log out" variant="danger" onPress={signOut} style={styles.logout} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gear: { height: 38, paddingHorizontal: spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  brandLogo: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface },
  brandEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandEmoji: { fontSize: 24 },
  brandText: { flex: 1 },
  brandName: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  brandStore: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 1 },
  welcome: { fontSize: fontSize.md, color: colors.textMuted, marginBottom: spacing.sm },
  banner: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  bannerDanger: { backgroundColor: '#FEF2F2', borderColor: colors.danger },
  bannerWarn: { backgroundColor: '#FFFBEB', borderColor: colors.warning },
  bannerText: { fontWeight: '600' },
  subValue: { fontSize: fontSize.lg, fontWeight: '800', marginTop: spacing.xs },
  newBill: { marginTop: spacing.md },
  kpiLabel: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '600' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  kpi: {
    flexGrow: 1,
    minWidth: '30%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  kpiAccent: { backgroundColor: colors.primary, borderColor: colors.primary, minWidth: '46%' },
  kpiLabelAccent: { fontSize: fontSize.sm, color: colors.white, opacity: 0.9, fontWeight: '600' },
  kpiValue: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, marginTop: spacing.xs },
  kpiValueAccent: { fontSize: fontSize.lg, fontWeight: '800', color: colors.white, marginTop: spacing.xs },
  cardHeading: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: 150,
    marginTop: spacing.sm,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: '70%', borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm },
  barLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  rowSpread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  warnCard: { borderColor: colors.warning, backgroundColor: '#FFFBEB' },
  dangerCard: { borderColor: colors.danger, backgroundColor: '#FEF2F2' },
  badgeWarn: { color: colors.warning, fontWeight: '800' },
  badgeDanger: { color: colors.danger, fontWeight: '800' },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  feedInfo: { flex: 1, marginRight: spacing.sm },
  feedName: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  feedMeta: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  feedRight: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  feedAmount: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 2 },
  moreText: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm },
  inlineBtn: { marginTop: spacing.md, height: 42 },
  inventoryBtn: { marginTop: spacing.xs },
  successText: { color: colors.success },
  dangerText: { color: colors.danger },
  warnText: { color: colors.warning },
  logout: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
