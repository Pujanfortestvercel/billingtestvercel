// ---------------------------------------------------------------------------
// AutocompleteInput — a text box that shows a live dropdown of suggestions as
// you type, and fills in the value when you tap one. Generic, so it works for
// BOTH customers and items (just pass different fetch/label functions).
// ---------------------------------------------------------------------------
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, fontSize, radius, spacing } from '../../theme';
import { useDebounce } from '../../hooks/useDebounce';

type Props<T> = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  fetchSuggestions: (query: string) => Promise<T[]>;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  placeholder?: string;
  minChars?: number;
  error?: string | null;
} & Pick<TextInputProps, 'autoCapitalize'>;

export function AutocompleteInput<T>({
  label,
  value,
  onChangeText,
  fetchSuggestions,
  getKey,
  getLabel,
  onSelect,
  placeholder,
  minChars = 1,
  error,
  autoCapitalize = 'words',
}: Props<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(value, 250);
  const skipNextRef = useRef(false); // don't re-open right after a selection

  useEffect(() => {
    // When the user just picked a suggestion, skip the fetch that the
    // resulting value-change would otherwise trigger.
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }

    let active = true;
    const q = debounced.trim();
    if (q.length < minChars) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    fetchSuggestions(q)
      .then(results => {
        if (!active) return;
        setSuggestions(results);
        setOpen(results.length > 0);
      })
      .catch(() => {
        if (active) setOpen(false);
      });
    return () => {
      active = false;
    };
  }, [debounced, minChars, fetchSuggestions]);

  function handleSelect(item: T) {
    skipNextRef.current = true;
    onSelect(item);
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        style={[styles.input, !!error && styles.inputError]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {open ? (
        <View style={[styles.dropdown, { top: label ? 74 : 52 }]}>
          {suggestions.map((item, i) => (
            <Pressable
              key={getKey(item)}
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [
                styles.row,
                i < suggestions.length - 1 && styles.rowDivider,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rowText}>{getLabel(item)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md, position: 'relative', zIndex: 1 },
  label: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.xs },
  dropdown: {
    // Float OVER the content below (instead of pushing Qty/Rate down out of
    // reach). `top` is set inline based on whether a label is shown.
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    maxHeight: 240,
    zIndex: 1000,
    elevation: 8,
  },
  row: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowPressed: { backgroundColor: colors.background },
  rowText: { fontSize: fontSize.md, color: colors.text },
});
