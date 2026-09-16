import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { AppIconName } from '@nestyk/ui/native';
import { MobileIcon, tokens } from '@nestyk/ui/native';

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
  themeColor?: string;
  summaryLabel: string;
  summaryTone: 'success' | 'warning';
  /** 0–1 progress for required sections. */
  progress?: number;
  disabled?: boolean;
  onSelect: (step: number) => void;
}

const ICON_BG = '#F1F5F9';
const ICON_FG = '#64748B';
const BRAND = tokens.colors.brand[500];

export const RoomEditSectionList: React.FC<RoomEditSectionListProps> = ({
  sections,
  summaryLabel,
  summaryTone,
  progress,
  disabled,
  onSelect,
}) => {
  const fill = Math.max(0, Math.min(1, progress ?? (summaryTone === 'success' ? 1 : 0.35)));

  return (
    <View style={styles.wrap}>
      <View style={styles.progressBlock}>
        <Text style={styles.progressLabel}>{summaryLabel}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round(fill * 100)}%`, backgroundColor: BRAND },
            ]}
          />
        </View>
      </View>

      <View style={styles.list}>
        {sections.map((section) => (
          <Pressable
            key={section.step}
            accessibilityRole="button"
            accessibilityLabel={`${section.label}. ${section.statusLabel}`}
            disabled={disabled}
            onPress={() => onSelect(section.step)}
            android_ripple={{ color: `${BRAND}22` }}
            style={({ pressed }) => [
              styles.card,
              pressed && Platform.OS === 'ios' ? { opacity: 0.72 } : null,
            ]}
          >
            <View style={styles.iconWrap}>
              <MobileIcon name={section.icon} size={20} color={ICON_FG} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{section.label}</Text>
              <Text style={styles.rowHint} numberOfLines={1}>
                {section.status === 'complete' ? section.hint : section.statusLabel}
              </Text>
            </View>
            {section.status === 'complete' ? (
              <View style={styles.completeBadge} accessibilityRole="image">
                <MobileIcon name="check" size={12} color={tokens.colors.white} weight="bold" />
              </View>
            ) : (
              <MobileIcon name="chevron-right" size={18} color={tokens.colors.divider} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  progressBlock: {
    gap: 8,
  },
  progressLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: tokens.colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#EEF2F6',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 72,
    backgroundColor: tokens.colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ICON_BG,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
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
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  completeBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.success,
  },
});
