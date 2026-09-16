import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MobileIcon,
  SelectionCheck,
  getSelectionSurfaceStyle,
  tokens,
} from '@nestyk/ui/native';

export type ContactListRowProps = {
  name: string;
  phone: string;
  roomsLabel: string;
  selected?: boolean;
  accentColor: string;
  onPress: () => void;
  disabled?: boolean;
};

/** Contact row with avatar, meta, and shared selection check. */
export function ContactListRow({
  name,
  phone,
  roomsLabel,
  selected = false,
  accentColor,
  onPress,
  disabled,
}: ContactListRowProps) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() || '?';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={disabled ? undefined : { color: '#00000014' }}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.row,
        getSelectionSurfaceStyle(selected, accentColor),
        { opacity: pressed && !disabled ? 0.92 : 1 },
      ]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.metaRow}>
          <MobileIcon name="phone" size={15} color={tokens.colors.textSecondary} />
          <Text style={styles.phone} numberOfLines={1}>
            {phone}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <MobileIcon name="buildings" size={14} color={tokens.colors.textSecondary} />
          <Text style={styles.rooms} numberOfLines={1}>
            {roomsLabel}
          </Text>
        </View>
      </View>
      <SelectionCheck
        selected={selected}
        variant="row"
        size="md"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 76,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: tokens.colors.textSecondary,
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phone: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 23,
    color: tokens.colors.textSecondary,
  },
  rooms: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
});
