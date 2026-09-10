import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon } from '../icons/MobileIcon';
import { AppIconName } from '../icons/types';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';

type LinkProvider = 'email' | 'phone' | 'google' | 'facebook' | 'apple';

interface LinkRow {
  id: LinkProvider;
  icon: AppIconName;
  iconColor?: string;
}

const PROVIDERS: LinkRow[] = [
  { id: 'email', icon: 'envelope' },
  { id: 'phone', icon: 'phone' },
  { id: 'google', icon: 'google', iconColor: '#EA4335' },
  { id: 'facebook', icon: 'facebook', iconColor: '#1877F2' },
  { id: 'apple', icon: 'apple' },
];

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export interface MobileLinkedAccountsBodyProps {
  email?: string;
  phone?: string;
}

/** Sign-in / OAuth link management — mock until Supabase Auth providers are wired. */
export const MobileLinkedAccountsBody: React.FC<MobileLinkedAccountsBodyProps> = ({
  email,
  phone,
}) => {
  const { t } = useLocale();
  const { theme, isDark } = useMobileTheme();
  const copy = t.mobile.account.linkedAccounts;

  const [linked, setLinked] = useState<Record<LinkProvider, boolean>>({
    email: Boolean(email),
    phone: Boolean(phone),
    google: false,
    facebook: false,
    apple: false,
  });

  const detailFor = (id: LinkProvider): string => {
    if (id === 'email' && email) return email;
    if (id === 'phone' && phone) return phone;
    return linked[id] ? copy.connected : copy.notConnected;
  };

  const onToggle = (id: LinkProvider) => {
    const next = !linked[id];
    setLinked((prev) => ({ ...prev, [id]: next }));
    Alert.alert(
      copy.title,
      next ? copy.connectSoon : copy.disconnectSoon,
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{copy.subtitle}</Text>

      <View
        style={[
          styles.card,
          nativeElevation(1),
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {PROVIDERS.map((row, index) => {
          const isOn = linked[row.id];
          const isLast = index === PROVIDERS.length - 1;
          return (
            <View key={row.id}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.iconBox,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.08)'
                        : tokens.colors.background,
                    },
                  ]}
                >
                  <MobileIcon
                    name={row.icon}
                    size={22}
                    color={row.iconColor ?? theme.textHeading}
                    weight={row.id === 'apple' || row.id === 'google' ? 'fill' : 'regular'}
                  />
                </View>
                <View style={styles.textCol}>
                  <Text style={[styles.label, { color: theme.textHeading }]}>
                    {copy.providers[row.id]}
                  </Text>
                  <Text style={[styles.detail, { color: theme.textSecondary }]} numberOfLines={1}>
                    {detailFor(row.id)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    isOn
                      ? { borderColor: theme.border, backgroundColor: theme.card }
                      : { borderColor: tokens.colors.brand[500], backgroundColor: tokens.colors.brand[500] },
                  ]}
                  onPress={() => onToggle(row.id)}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`${isOn ? copy.disconnect : copy.connect} ${copy.providers[row.id]}`}
                >
                  <Text
                    style={[
                      styles.actionLabel,
                      { color: isOn ? theme.textHeading : tokens.colors.primary },
                    ]}
                  >
                    {isOn ? copy.disconnect : copy.connect}
                  </Text>
                </TouchableOpacity>
              </View>
              {!isLast ? (
                <View style={[styles.divider, { borderTopColor: theme.border }]} />
              ) : null}
            </View>
          );
        })}
      </View>

      <Text style={[styles.footnote, { color: theme.textSecondary }]}>{copy.footnote}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 28,
  },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  detail: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  actionLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginLeft: 52,
  },
  footnote: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
  },
});
