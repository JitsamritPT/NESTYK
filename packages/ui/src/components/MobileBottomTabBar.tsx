import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon } from '../icons/MobileIcon';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';
import { ExtendedTabRole, getTabsForRole } from '../config/mobileTabMatrix';

export type MobileAppTab =
  | 'home'
  | 'search'
  | 'living'
  | 'bills'
  | 'dashboard'
  | 'listings'
  | 'income'
  | 'deals'
  | 'tickets'
  | 'services'
  | 'menu';

export interface MobileBottomTabBarProps {
  activeRole: ExtendedTabRole;
  activeTab: MobileAppTab;
  onTabPress: (tab: MobileAppTab) => void;
  accentColor?: string;
}

export const MobileBottomTabBar: React.FC<MobileBottomTabBarProps> = ({
  activeRole,
  activeTab,
  onTabPress,
  accentColor = tokens.colors.accent,
}) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const tabs = getTabsForRole(activeRole);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const label = t.mobile.tabs[tab.key];
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.7}
          >
            <MobileIcon
              name={tab.icon}
              size={22}
              color={isActive ? accentColor : theme.textSecondary}
              weight={isActive ? 'bold' : 'regular'}
            />
            <Text
              style={[
                styles.tabLabel,
                isActive ? { color: accentColor, fontWeight: '600' } : { color: theme.textSecondary },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    minWidth: 0,
  },
  tabLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '400',
  },
});
