import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';

export interface MobileHeaderActionsProps {
  initials?: string;
  notificationCount?: number;
  onAvatarPress?: () => void;
  onNotificationsPress?: () => void;
  onThemeToggle?: () => void;
}

export const MobileHeaderActions: React.FC<MobileHeaderActionsProps> = ({
  initials = 'JD',
  notificationCount = 0,
  onAvatarPress,
  onNotificationsPress,
  onThemeToggle,
}) => {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.avatar} onPress={onAvatarPress} activeOpacity={0.8}>
        <Text style={styles.avatarText}>{initials}</Text>
      </TouchableOpacity>

      <View style={styles.actions}>
        {onThemeToggle ? (
          <TouchableOpacity style={styles.iconBtn} onPress={onThemeToggle} activeOpacity={0.7}>
            <MobileIcon name="moon" size={22} tone="inactive" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.iconBtn} onPress={onNotificationsPress} activeOpacity={0.7}>
          <MobileIcon name="bell" size={22} tone="inactive" />
          {notificationCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{notificationCount > 9 ? '9+' : notificationCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingEn,
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: tokens.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
  },
});
