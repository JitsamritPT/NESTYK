import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon } from '../icons/MobileIcon';
import { MobileNestykLogo } from './MobileNestykLogo';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';
import { ExtendedTabRole, getTabsForRole } from '../config/mobileTabMatrix';
import { AppIconName } from '../icons/types';

export type MobileAppTab =
  | 'home'
  | 'search'
  | 'living'
  | 'bills'
  | 'dashboard'
  | 'listings'
  | 'listingRoom'
  | 'createListing'
  | 'listingLead'
  | 'contact'
  | 'calendar'
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

/** Shared slot so every tab label sits on the same baseline */
const ICON_SLOT = 24;
const ICON_SIZE = 22;
const SERVICES_LOGO_SIZE = 22;

function ServicesTabIcon({ isActive, accentColor }: { isActive: boolean; accentColor: string }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.06 : 1, {
      damping: 14,
      stiffness: 200,
      mass: 0.6,
    });
  }, [isActive, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: isActive ? 1 : 0.88,
  }));

  return (
    <View style={styles.iconSlot}>
      <Animated.View
        style={[
          styles.servicesIconWrap,
          isActive && { backgroundColor: `${accentColor}22` },
          animStyle,
        ]}
        >
        <MobileNestykLogo variant="mark" height={SERVICES_LOGO_SIZE} />
      </Animated.View>
    </View>
  );
}

function RegularTabIcon({
  name,
  isActive,
  accentColor,
  mutedColor,
}: {
  name: AppIconName;
  isActive: boolean;
  accentColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.iconSlot}>
      <MobileIcon
        name={name}
        size={ICON_SIZE}
        color={isActive ? accentColor : mutedColor}
        weight={isActive ? 'bold' : 'regular'}
      />
    </View>
  );
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
        const isServices = tab.key === 'services';
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => onTabPress(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
          >
            {isServices ? (
              <ServicesTabIcon isActive={isActive} accentColor={accentColor} />
            ) : (
              <RegularTabIcon
                name={tab.icon}
                isActive={isActive}
                accentColor={accentColor}
                mutedColor={theme.textSecondary}
              />
            )}
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
  iconSlot: {
    width: ICON_SLOT,
    height: ICON_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesIconWrap: {
    width: SERVICES_LOGO_SIZE,
    height: SERVICES_LOGO_SIZE,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '400',
  },
});
