// Shown to a logged-in business user whose account is still 'pending'
// (the admin hasn't approved them yet, so their trial hasn't started).
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/common/ScreenContainer';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { colors, fontSize, spacing } from '../theme';

export function PendingApprovalScreen() {
  const { user, signOut } = useAuth();
  const { refresh } = useSubscription();
  const [checking, setChecking] = useState(false);

  async function checkAgain() {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.emoji}>🔒</Text>
        <Text style={styles.title}>Account not active yet</Text>
        <Text style={styles.subtitle}>
          Your account ({user?.email}) is frozen. An admin needs to unfreeze it
          to start your 21-day free trial. Please check back soon.
        </Text>
      </View>

      <Card>
        <Text style={styles.note}>Already approved? Tap to refresh.</Text>
        <Button title="Check again" onPress={checkAgain} loading={checking} />
      </Card>

      <Button title="Log out" variant="danger" onPress={signOut} style={styles.logout} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginVertical: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.sm },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  note: { color: colors.textMuted, marginBottom: spacing.sm },
  logout: { marginTop: spacing.lg },
});
