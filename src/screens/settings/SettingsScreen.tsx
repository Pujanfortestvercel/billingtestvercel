// ---------------------------------------------------------------------------
// SETTINGS — pick your store type (changes the billing form + invoice) and set
// your shop profile (name, owner's phone, address) that prints on every
// invoice. Saved to the database, so it follows you across devices.
//
// The shop logo is picked from the device's photo library (react-native-image-
// picker), downscaled, and stored as a data URL in settings.logo_url — the same
// shape the web app uses, so it prints on invoices identically.
// ---------------------------------------------------------------------------
import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { TextField } from '../../components/common/TextField';
import { Loading } from '../../components/common/Loading';
import { useSettings } from '../../context/SettingsContext';
import { STORE_TYPE_LIST, type StoreType } from '../../config/storeTypes';
import { colors, fontSize, radius, spacing } from '../../theme';

export function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { settings, store, loading, save } = useSettings();

  const [storeType, setStoreType] = useState<StoreType>('grocery');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setStoreType((settings.store_type as StoreType) ?? 'grocery');
    setShopName(settings.shop_name ?? '');
    setPhone(settings.phone ?? '');
    setAddress(settings.address ?? '');
    setLogo(settings.logo_url ?? null);
  }, [settings]);

  async function pickLogo() {
    try {
      // Downscale on pick (maxWidth/Height) so the stored data URL stays small
      // and prints crisply, matching the web's 240px logo.
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        maxWidth: 240,
        maxHeight: 240,
        quality: 0.8,
      });
      if (result.didCancel) return;
      const asset = result.assets?.[0];
      if (result.errorCode || !asset?.base64) {
        if (result.errorCode) Alert.alert('Could not read that image.', result.errorMessage ?? '');
        return;
      }
      setLogo(`data:${asset.type ?? 'image/jpeg'};base64,${asset.base64}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not pick an image.');
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      await save({
        store_type: storeType,
        shop_name: shopName.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url: logo,
      });
      Alert.alert('Saved ✅', 'Your settings have been updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading text="Loading settings…" />;

  return (
    <ScreenContainer title="Settings" scroll onBack={() => navigation.goBack()}>
      {/* Store type */}
      <Text style={styles.sectionTitle}>Store type</Text>
      <Text style={styles.sectionHint}>
        This changes the fields on the billing form and the invoice layout.
      </Text>
      <View style={styles.grid}>
        {STORE_TYPE_LIST.map(s => {
          const active = s.key === storeType;
          return (
            <Pressable
              key={s.key}
              onPress={() => setStoreType(s.key)}
              style={[styles.storeCard, active && styles.storeCardActive]}
            >
              <Text style={styles.storeEmoji}>{s.emoji}</Text>
              <Text style={styles.storeLabel}>{s.label}</Text>
              <Text style={styles.storeBlurb}>{s.blurb}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Shop profile */}
      <Text style={styles.sectionTitle}>Shop profile</Text>
      <Text style={styles.sectionHint}>
        Shown on the header of every invoice you print or share.
      </Text>
      <Card>
        <View style={styles.logoRow}>
          <Pressable onPress={pickLogo} style={styles.logoBox}>
            {logo ? (
              <Image source={{ uri: logo }} style={styles.logoImg} resizeMode="cover" />
            ) : (
              <Text style={styles.logoPlaceholder}>+ Logo</Text>
            )}
          </Pressable>
          <View style={styles.logoActions}>
            <Button title={logo ? 'Change logo' : 'Add logo'} variant="ghost" onPress={pickLogo} style={styles.logoBtn} />
            {logo ? (
              <Button title="Remove" variant="danger" onPress={() => setLogo(null)} style={styles.logoBtn} />
            ) : null}
          </View>
        </View>
        <TextField
          label="Shop name"
          value={shopName}
          onChangeText={setShopName}
          placeholder="e.g. Sharma General Store"
        />
        <TextField
          label="Owner's phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. +91 98765 43210"
          keyboardType="phone-pad"
        />
        <TextField
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Shop address"
          multiline
          numberOfLines={3}
          style={styles.textarea}
        />
      </Card>

      <Button title="Save settings" onPress={onSave} loading={saving} style={styles.save} />
      <Text style={styles.current}>
        Current store type: <Text style={styles.currentStrong}>{store.label}</Text>
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.md,
  },
  sectionHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  storeCard: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  storeCardActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  storeEmoji: { fontSize: 22 },
  storeLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  storeBlurb: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  textarea: { height: 90, textAlignVertical: 'top', paddingTop: spacing.sm },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  logoBox: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  logoPlaceholder: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600' },
  logoActions: { flex: 1, gap: spacing.xs },
  logoBtn: { height: 40 },
  save: { marginTop: spacing.lg },
  current: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: spacing.sm, marginBottom: spacing.xl },
  currentStrong: { fontWeight: '700', color: colors.text },
});
