import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

export type MobileStatusPillTone = {
  bg: string;
  fg: string;
};

export const STATUS_PILL_TONES = {
  yellow: { bg: '#FEF3C7', fg: '#B45309' },
  blue: { bg: '#DBEAFE', fg: '#1D4ED8' },
  purple: { bg: '#EDE9FE', fg: '#6D28D9' },
  green: { bg: '#DCFCE7', fg: '#15803D' },
  rose: { bg: '#FCE7F3', fg: '#BE185D' },
  red: { bg: '#FEE2E2', fg: '#B91C1C' },
  slate: { bg: '#F1F5F9', fg: '#475569' },
} as const satisfies Record<string, MobileStatusPillTone>;

export type MobileStatusPillToneKey = keyof typeof STATUS_PILL_TONES;

export function MobileStatusPill({
  label,
  tone = 'slate',
  style,
}: {
  label: string;
  tone?: MobileStatusPillToneKey | MobileStatusPillTone;
  style?: ViewStyle;
}) {
  const colors = typeof tone === 'string' ? STATUS_PILL_TONES[tone] : tone;
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.label, { color: colors.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    maxWidth: 140,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
});
