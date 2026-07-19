// Shown until Supabase keys are added to src/config/supabase.ts.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../components/common/ScreenContainer';
import { Card } from '../components/common/Card';
import { colors, fontSize, spacing } from '../theme';

export function NotConfiguredScreen() {
  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <Text style={styles.emoji}>🔌</Text>
        <Text style={styles.title}>Connect your backend</Text>
        <Text style={styles.subtitle}>
          The app is built and ready — it just needs your free Supabase project.
        </Text>
      </View>

      <Card>
        <Text style={styles.step}>1. Follow the guide in SUPABASE_SETUP.md</Text>
        <Text style={styles.step}>2. Run supabase/schema.sql in Supabase</Text>
        <Text style={styles.step}>
          3. Paste your Project URL + anon key into{'\n'}
          <Text style={styles.code}>src/config/supabase.ts</Text>
        </Text>
        <Text style={styles.step}>4. Save — the app reloads into Login.</Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginVertical: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.sm },
  title: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.text },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  step: { fontSize: fontSize.md, color: colors.text, marginBottom: spacing.sm },
  code: { fontWeight: '700', color: colors.primary },
});
