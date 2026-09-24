import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MobileIcon } from '../icons/MobileIcon';
import { getCardElevation } from '../theme/elevation';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export function MobileCompactListRow({
  avatarLabel,
  avatarTone,
  title,
  subtitle,
  meta,
  trailing,
  footer,
  aside,
  onPress,
  accessibilityLabel,
  style,
}: {
  avatarLabel: string;
  avatarTone: { bg: string; fg: string };
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  /** Inline after the title (e.g. a status pill). */
  trailing?: React.ReactNode;
  /** Row below meta inside the text column. */
  footer?: React.ReactNode;
  /** Right column before the chevron (e.g. a score ring). */
  aside?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useMobileTheme();
  const elevation = getCardElevation(1);
  const { boxShadow: _webOnly, ...cardElevation } = elevation;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      style={({ pressed }) => [
        styles.card,
        cardElevation,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed && Platform.OS === 'ios' ? 0.92 : 1,
        },
        style,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarTone.bg }]}>
        <Text style={[styles.avatarText, { color: avatarTone.fg }]} numberOfLines={1}>
          {avatarLabel}
        </Text>
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={1}>
            {title}
          </Text>
          {trailing}
        </View>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text style={[styles.meta, { color: theme.textHeading }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
      {aside}
      <MobileIcon name="chevron-right" size={18} color={tokens.colors.divider} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 72,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  meta: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
});
