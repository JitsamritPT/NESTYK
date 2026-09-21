import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { tokens } from '../theme/tokens';
import { getSelectionSurfaceStyle } from '../theme/selection';
import { SelectionCheck } from './SelectionCheck';

export type SelectionChipProps = {
  label: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Brand/role accent for selected border (default brand yellow). */
  accentColor?: string;
  /** Selected label color (default primary dark — never match check amber). */
  inkColor?: string;
  /** When false, selected state is border/fill only (filter pills). Default true. */
  showCheck?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * Selectable chip — cream + yellow border when selected.
 * Optional outline check (default on); filter pills can omit it.
 */
export function SelectionChip({
  label,
  subtitle,
  selected = false,
  disabled = false,
  onPress,
  accentColor = tokens.colors.brand[500],
  inkColor = tokens.colors.primary,
  showCheck = true,
  style,
  labelStyle,
  testID,
}: SelectionChipProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={disabled ? undefined : { color: '#00000022' }}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        getSelectionSurfaceStyle(selected, accentColor),
        disabled && !selected ? styles.disabled : null,
        pressed && !disabled ? { opacity: 0.88 } : null,
        style,
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.labelRow}>
          {showCheck ? (
            <SelectionCheck selected={selected} variant="chip" size="sm" />
          ) : null}
          <Text
            style={[
              styles.label,
              selected ? { color: inkColor, fontWeight: '700' } : null,
              disabled && !selected ? styles.labelDisabled : null,
              labelStyle,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
        {subtitle ? (
          <Text
            style={[
              styles.subtitle,
              selected ? styles.subtitleSelected : null,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minWidth: 0,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  disabled: {
    backgroundColor: tokens.colors.background,
    opacity: 0.7,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  labelDisabled: {
    color: tokens.colors.textSecondary,
  },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  subtitleSelected: {
    color: tokens.colors.textHeading,
    fontWeight: '600',
  },
});
