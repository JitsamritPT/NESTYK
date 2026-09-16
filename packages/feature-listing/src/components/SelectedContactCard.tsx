import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  MobileIcon,
  SelectionCheck,
  getSelectionSurfaceStyle,
  tokens,
} from '@nestyk/ui/native';
import { getCardElevation } from '@nestyk/ui';

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export type SelectedContactCardProps = {
  label?: string;
  name: string;
  phone: string;
  roomsLabel: string;
  accentColor: string;
  removeLabel?: string;
  onRemove?: () => void;
};

/** Selected contact card for Room contact section (optional remove). */
export function SelectedContactCard({
  label,
  name,
  phone,
  roomsLabel,
  accentColor,
  removeLabel,
  onRemove,
}: SelectedContactCardProps) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() || '?';
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.card,
          getSelectionSurfaceStyle(true, accentColor),
          nativeElevation(1),
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
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={removeLabel ?? 'Remove'}
            hitSlop={10}
            style={({ pressed }) => [
              styles.removeBtn,
              { opacity: pressed ? 0.55 : 1 },
            ]}
          >
            <MobileIcon name="close" size={18} color={tokens.colors.textSecondary} weight="bold" />
          </Pressable>
        ) : (
          <SelectionCheck selected variant="row" size="md" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 84,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: tokens.colors.textSecondary,
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
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
    fontSize: 16,
    lineHeight: 24,
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
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
