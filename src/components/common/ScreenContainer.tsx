// Standard page wrapper: safe-area aware, optional title header, optional
// scrolling. Use this as the outer element of every screen for consistency.
import React, { type PropsWithChildren, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSize, spacing } from '../../theme';

type Props = PropsWithChildren<{
  title?: string;
  right?: ReactNode; // e.g. a button shown on the right of the title
  onBack?: () => void; // shows a back chevron before the title (pushed screens)
  scroll?: boolean;
  contentStyle?: ViewStyle;
}>;

export function ScreenContainer({
  title,
  right,
  onBack,
  scroll,
  contentStyle,
  children,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            {onBack ? (
              <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
                <Text style={styles.backText}>‹</Text>
              </Pressable>
            ) : null}
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </View>
          {right ?? null}
        </View>
      ) : null}

      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.content, contentStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, flexShrink: 1 },
  back: { marginRight: spacing.sm, paddingHorizontal: spacing.xs },
  backText: { fontSize: 34, lineHeight: 34, color: colors.primary, fontWeight: '700' },
  content: { padding: spacing.md },
});
