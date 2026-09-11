import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export interface MobileSectionHeaderProps {
  /** Primary page title (shown once — do not repeat in body). */
  title: string;
  /** Passive role / workspace label under the title */
  workspaceLabel?: string;
  accentColor?: string;
  /** Main tabs: menu. Secondary flows (e.g. create listing): back. */
  leading?: 'menu' | 'back';
  onMenuPress?: () => void;
  onBackPress?: () => void;
  /** When set, shows search affordance on the right */
  onSearchPress?: () => void;
  searchActive?: boolean;
  searchAccessibilityLabel?: string;
}

/**
 * List / hub / secondary header for Agent (and later Owner).
 * Overview brand logo stays on `MobileWorkspaceHeader` only.
 */
export const MobileSectionHeader: React.FC<MobileSectionHeaderProps> = ({
  title,
  workspaceLabel,
  accentColor = tokens.colors.roles.agent,
  leading = 'menu',
  onMenuPress,
  onBackPress,
  onSearchPress,
  searchActive = false,
  searchAccessibilityLabel = 'Search',
}) => {
  const { theme } = useMobileTheme();
  const ink = theme.screenTitle || tokens.colors.primary;
  const isBack = leading === 'back';

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={isBack ? onBackPress : onMenuPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isBack ? 'Back' : 'Menu'}
      >
        <MobileIcon name={isBack ? 'chevron-left' : 'menu'} size={22} color={ink} />
      </TouchableOpacity>

      <View style={styles.titleBlock} accessibilityRole="header">
        <Text style={[styles.title, { color: ink }]} numberOfLines={1}>
          {title}
        </Text>
        {workspaceLabel ? (
          <View style={styles.workspaceRow}>
            <View style={[styles.rule, { backgroundColor: accentColor }]} />
            <Text
              style={[styles.workspaceLabel, { color: ink }]}
              numberOfLines={1}
              accessibilityRole="text"
            >
              {workspaceLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {onSearchPress ? (
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onSearchPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={searchAccessibilityLabel}
          accessibilityState={{ selected: searchActive }}
        >
          <MobileIcon
            name={searchActive ? 'close' : 'search'}
            size={22}
            color={searchActive ? tokens.colors.brand[500] : ink}
          />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 44,
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '500',
  },
  workspaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rule: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  workspaceLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
