import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';

export type SelectionCheckProps = {
  selected: boolean;
  /** `chip` = check only when selected (no empty radio). `row` = empty ring when idle. */
  variant?: 'chip' | 'row';
  size?: 'sm' | 'md';
  /** Outline + check when selected (default selectionMark amber). */
  color?: string;
};

/**
 * Shared selection mark — one outline circle, white fill, plain check.
 */
export function SelectionCheck({
  selected,
  variant = 'chip',
  size = 'sm',
  color = tokens.colors.selectionMark,
}: SelectionCheckProps) {
  const dim = size === 'md' ? 24 : 20;
  const icon = size === 'md' ? 15 : 13;

  if (!selected) {
    if (variant === 'chip') return null;
    return <View style={[styles.idle, { width: dim, height: dim, borderRadius: dim / 2 }]} />;
  }

  return (
    <View
      style={[
        styles.selected,
        {
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          borderColor: color,
          backgroundColor: '#FFFFFF',
        },
      ]}
    >
      <MobileIcon name="check" size={icon} color={color} weight="bold" />
    </View>
  );
}

const styles = StyleSheet.create({
  idle: {
    borderWidth: 1.5,
    borderColor: tokens.colors.divider,
    backgroundColor: '#FFFFFF',
  },
  selected: {
    borderWidth: 1.75,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
});
