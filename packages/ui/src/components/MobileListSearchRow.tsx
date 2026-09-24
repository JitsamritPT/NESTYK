import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { MobileIcon } from '../icons/MobileIcon';
import type { AppIconName } from '../icons/types';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export function MobileListSearchRow({
  value,
  onChangeText,
  placeholder,
  onClear,
  onFilterPress,
  filterActive = false,
  filterBadgeCount,
  filterIcon = 'funnel',
  filterAccessibilityLabel,
  clearAccessibilityLabel,
  inputRef,
  onBlur,
  style,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onClear?: () => void;
  onFilterPress?: () => void;
  filterActive?: boolean;
  filterBadgeCount?: number;
  filterIcon?: AppIconName;
  filterAccessibilityLabel?: string;
  clearAccessibilityLabel?: string;
  inputRef?: React.RefObject<TextInput | null>;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useMobileTheme();
  const showBadge = (filterBadgeCount ?? 0) > 0;

  return (
    <View style={[styles.row, style]}>
      <View
        style={[
          styles.field,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <MobileIcon name="search" size={18} color={theme.textSecondary} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.textHeading }]}
          returnKeyType="search"
          onBlur={onBlur}
        />
        {value.trim() && onClear ? (
          <Pressable
            onPress={onClear}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={clearAccessibilityLabel}
          >
            <MobileIcon name="close" size={16} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {onFilterPress ? (
        <Pressable
          onPress={onFilterPress}
          accessibilityRole="button"
          accessibilityLabel={filterAccessibilityLabel}
          style={({ pressed }) => [
            styles.filterBtn,
            {
              borderColor: filterActive || showBadge ? tokens.colors.brand[500] : theme.border,
              backgroundColor: theme.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          {...(Platform.OS === 'android'
            ? { android_ripple: { color: 'rgba(0,0,0,0.08)' } }
            : {})}
        >
          <MobileIcon
            name={filterIcon}
            size={20}
            color={filterActive || showBadge ? tokens.colors.primary : theme.textHeading}
          />
          {showBadge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterBadgeCount}</Text>
            </View>
          ) : filterActive ? (
            <View style={styles.activeDot} />
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: tokens.colors.brand[500],
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
});
