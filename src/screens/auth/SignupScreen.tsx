import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { TextField } from '../../components/common/TextField';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { rememberPendingStoreType } from '../../context/SettingsContext';
import { STORE_TYPE_LIST, type StoreType } from '../../config/storeTypes';
import { colors, fontSize, radius, spacing } from '../../theme';
import { APP_NAME, TRIAL_DAYS } from '../../config/constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [storeType, setStoreType] = useState<StoreType>('grocery');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!email.trim() || !password) {
      setError('Please enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await signUp(email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    // Apply this store type when the account's settings row is first created.
    await rememberPendingStoreType(storeType);
    // If email confirmation is OFF, the app auto-logs in and routes away.
    // If it's ON, there's no session yet, so guide them to log in.
    Alert.alert(
      'Account created 🎉',
      `Your ${TRIAL_DAYS}-day free trial has started. If asked, confirm your email, then log in.`,
      [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.logo}>🧾</Text>
        <Text style={styles.title}>Create your {APP_NAME}</Text>
        <Text style={styles.subtitle}>{TRIAL_DAYS} days free — no card needed</Text>
      </View>

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 6 characters"
        secureTextEntry
      />
      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Re-type your password"
        secureTextEntry
      />

      <Text style={styles.pickLabel}>What kind of store do you run?</Text>
      <View style={styles.storeGrid}>
        {STORE_TYPE_LIST.map(s => {
          const active = s.key === storeType;
          return (
            <Pressable
              key={s.key}
              onPress={() => setStoreType(s.key)}
              style={[styles.storeChip, active && styles.storeChipActive]}
            >
              <Text style={[styles.storeChipText, active && styles.storeChipTextActive]}>
                {s.emoji}  {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Create Account" onPress={handleSignup} loading={loading} />
      <Button
        title="I already have an account"
        variant="ghost"
        onPress={() => navigation.navigate('Login')}
        style={styles.secondary}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.lg },
  logo: { fontSize: 56 },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, marginTop: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.xs },
  pickLabel: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  storeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  storeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  storeChipActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  storeChipText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  storeChipTextActive: { color: colors.primary, fontWeight: '800' },
  error: { color: colors.danger, marginBottom: spacing.sm, textAlign: 'center' },
  secondary: { marginTop: spacing.sm },
});
