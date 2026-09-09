import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppIconName } from '@nestyk/ui/native';
import { MobileIcon, getCardElevation, tokens } from '@nestyk/ui/native';

export type RoomEditSectionStatus = 'complete' | 'incomplete' | 'empty';

export type RoomEditSection = {
  step: number;
  icon: AppIconName;
  label: string;
  hint: string;
  status: RoomEditSectionStatus;
  /** Short status line, e.g. "2 fields missing" or "Not added yet". */
  statusLabel: string;
};

export interface RoomEditSectionListProps {
  sections: RoomEditSection[];
  themeColor: string;
  summaryLabel: string;
  summaryTone: 'success' | 'warning';
  disabled?: boolean;
  onSelect: (step: number) => void;
}

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

const STATUS_COLOR: Record<RoomEditSectionStatus, string> = {
  complete: tokens.colors.success,
  incomplete: tokens.colors.warning,
  empty: tokens.colors.textSecondary,
};

const STATUS_ICON: Record<RoomEditSectionStatus, AppIconName> = {
  complete: 'check',
  incomplete: 'warning',
  empty: 'chevron-right',
};

export const RoomEditSectionList: React.FC<RoomEditSectionListProps> = ({
  sections,
  themeColor,
  summaryLabel,
  summaryTone,
  disabled,
  onSelect,
}) => {
  const summaryColor = summaryTone === 'success' ? tokens.colors.success : tokens.colors.warning;
  return (
    <View style={styles.wrap}>
      <View style={[styles.summary, { borderColor: `${summaryColor}55`, backgroundColor: `${summaryColor}12` }]}>
        <MobileIcon name={summaryTone === 'success' ? 'check' : 'warning'} size={20} color={summaryColor} weight="fill" />
        <Text style={[styles.summaryText, { color: summaryColor }]}>{summaryLabel}</Text>
      </View>

      <View style={[styles.card, nativeElevation(1)]}>
        {sections.map((section, index) => {
          const statusColor = STATUS_COLOR[section.status];
          return (
            <Pressable
              key={section.step}
              accessibilityRole="button"
              accessibilityLabel={`${section.label}. ${section.statusLabel}`}
              disabled={disabled}
              onPress={() => onSelect(section.step)}
              android_ripple={{ color: `${themeColor}22` }}
              style={({ pressed }) => [
                styles.row,
                index < sections.length - 1 && styles.rowDivider,
                pressed && Platform.OS === 'ios' ? { opacity: 0.7 } : null,
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${themeColor}14` }]}>
                <MobileIcon name={section.icon} size={20} color={themeColor} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{section.label}</Text>
                <Text style={styles.rowHint} numberOfLines={1}>{section.hint}</Text>
                <View style={styles.statusRow}>
                  {section.status !== 'empty' && (
                    <MobileIcon name={STATUS_ICON[section.status]} size={14} color={statusColor} weight="fill" />
                  )}
                  <Text style={[styles.statusText, { color: statusColor }]}>{section.statusLabel}</Text>
                </View>
              </View>
              <MobileIcon name="chevron-right" size={18} tone="muted" />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  rowHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  statusText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});
