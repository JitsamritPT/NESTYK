import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { tokens } from '../theme/tokens';
import { MobileIcon } from '../icons/MobileIcon';

export type MobileAiQuotaActionProps = {
  label: string;
  /** Pre-formatted quota, e.g. "8/10 left" */
  quotaText?: string;
  remaining: number;
  limit: number;
  /** When false, hide the quota chip (e.g. mock quota until backend is ready). */
  showQuota?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  showIcon?: boolean;
  accessibilityLabel?: string;
};

/**
 * Shared AI action with optional quota badge.
 * Parent owns remaining/limit state and API calls — this is UI only.
 */
export const MobileAiQuotaAction: React.FC<MobileAiQuotaActionProps> = ({
  label,
  quotaText = '',
  remaining,
  limit,
  showQuota = true,
  loading = false,
  disabled = false,
  onPress,
  style,
  showIcon = true,
  accessibilityLabel,
}) => {
  const exhausted = remaining <= 0;
  const isDisabled = disabled || loading || exhausted;
  const displayQuota =
    quotaText.trim() ||
    `${Math.max(0, remaining)}/${Math.max(0, limit)}`;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ||
        (showQuota ? `${label}. ${displayQuota}` : label)
      }
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.btn,
        exhausted ? styles.btnExhausted : null,
        isDisabled && !loading ? styles.btnDisabled : null,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={tokens.colors.primary} size="small" />
      ) : (
        <>
          <View style={styles.labelRow}>
            {showIcon ? (
              <MobileIcon
                name="sparkle"
                size={14}
                color={exhausted ? tokens.colors.textSecondary : tokens.colors.brand[600]}
              />
            ) : null}
            <Text
              style={[styles.label, exhausted ? styles.labelExhausted : null]}
              numberOfLines={1}
            >
              {label}
            </Text>
          </View>
          {showQuota ? (
            <View style={[styles.quotaChip, exhausted ? styles.quotaChipExhausted : null]}>
              <Text style={[styles.quotaText, exhausted ? styles.quotaTextExhausted : null]}>
                {displayQuota}
              </Text>
            </View>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 112,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: tokens.colors.brand[500],
  },
  btnExhausted: {
    borderColor: tokens.colors.border,
    backgroundColor: '#F8FAFC',
  },
  btnDisabled: {
    opacity: 0.65,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  labelExhausted: {
    color: tokens.colors.textSecondary,
  },
  quotaChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
  },
  quotaChipExhausted: {
    backgroundColor: '#E2E8F0',
  },
  quotaText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  quotaTextExhausted: {
    color: tokens.colors.textSecondary,
  },
});
