import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export function MobileListToolbar({
  countLabel,
  children,
  style,
}: {
  countLabel: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useMobileTheme();
  return (
    <View style={[styles.row, style]}>
      <Text style={[styles.count, { color: theme.textSecondary }]} numberOfLines={1}>
        {countLabel}
      </Text>
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 44,
  },
  count: {
    flexShrink: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
});
