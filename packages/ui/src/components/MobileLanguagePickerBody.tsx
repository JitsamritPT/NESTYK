import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocale, SupportedLocale } from '@nestyk/i18n';
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';

export const MOBILE_LOCALE_OPTIONS: SupportedLocale[] = ['th', 'en', 'zh', 'ja'];

const BRAND_YELLOW = tokens.colors.brand[500];

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function brandSoftFill(dark: boolean): string {
  return hexToRgba(BRAND_YELLOW, dark ? 0.16 : 0.14);
}

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export interface MobileLanguagePickerBodyProps {
  /** Called after locale is applied (e.g. close sheet / sub-view). */
  onSelect?: (locale: SupportedLocale) => void;
  /** Show “Language” title above the list (bottom sheet). */
  showTitle?: boolean;
  /** Card elevation around the list (default true). */
  elevated?: boolean;
}

/** Shared language list — same look in login sheet and profile drawer. */
export const MobileLanguagePickerBody: React.FC<MobileLanguagePickerBodyProps> = ({
  onSelect,
  showTitle = false,
  elevated = true,
}) => {
  const { t, locale, setLocale } = useLocale();
  const { theme, isDark } = useMobileTheme();
  const brandSoft = brandSoftFill(isDark);

  return (
    <View style={showTitle ? styles.sheetWrap : undefined}>
      {showTitle ? (
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.textHeading }]}
        >
          {t.mobile.settings.language}
        </Text>
      ) : null}
      <View
        style={[
          styles.list,
          elevated ? nativeElevation(1) : null,
          { backgroundColor: theme.card },
        ]}
      >
        {MOBILE_LOCALE_OPTIONS.map((option, index) => {
          const isActive = locale === option;
          const isLast = index === MOBILE_LOCALE_OPTIONS.length - 1;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.option,
                !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
                isActive && { backgroundColor: brandSoft },
              ]}
              onPress={() => {
                setLocale(option);
                onSelect?.(option);
              }}
              activeOpacity={0.75}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={t.mobile.settings.languageNames[option]}
            >
              <Text
                style={[
                  styles.optionLabel,
                  { color: theme.textHeading },
                  isActive && {
                    color: isDark ? BRAND_YELLOW : tokens.colors.primary,
                    fontWeight: '700',
                  },
                ]}
              >
                {t.mobile.settings.languageNames[option]}
              </Text>
              {isActive ? (
                <MobileIcon name="check" size={20} color={BRAND_YELLOW} weight="bold" />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetWrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    marginBottom: 10,
  },
  list: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  optionLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});
