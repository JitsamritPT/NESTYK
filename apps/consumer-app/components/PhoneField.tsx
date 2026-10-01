import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { LeadSelectField } from './LeadSelectField';
import {
  PHONE_COUNTRIES,
  PHONE_OTHER,
  callingCode,
  examplePhone,
  flagEmoji,
  formatPhoneDraft,
  nextPhoneDraft,
  switchPhoneRegion,
  type PhoneDraft,
  type PhoneRegion,
} from '../lib/phone';

/** Country code picker + digits-only number input that formats and stops at the country's length. */
export function PhoneField({
  label,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}: {
  label: string;
  value: PhoneDraft;
  onChange: (next: PhoneDraft) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  const c = t.agent.leads;
  const { theme } = useMobileTheme();

  const options = [
    ...PHONE_COUNTRIES.map((code) => ({
      value: code as PhoneRegion,
      label: `${flagEmoji(code)}  ${c.phoneCountries[code]}  ${callingCode(code)}`,
      shortLabel: `${flagEmoji(code)} ${callingCode(code)}`,
    })),
    { value: PHONE_OTHER as PhoneRegion, label: `${flagEmoji(PHONE_OTHER)}  ${c.otherCountry}`, shortLabel: `${flagEmoji(PHONE_OTHER)} +` },
  ];

  return (
    <View style={styles.group}>
      <Text style={[styles.label, { color: theme.textHeading }]}>
        {label}
        {required ? <Text style={styles.requiredMark}> *</Text> : null}
      </Text>
      <View style={styles.row}>
        <LeadSelectField<PhoneRegion>
          style={styles.country}
          hideLabel
          label={c.phoneCountry}
          placeholder={c.phoneCountry}
          value={value.region}
          disabled={disabled}
          options={options}
          onChange={(region) => region && onChange(switchPhoneRegion(value, region))}
        />
        <MobileInput
          containerStyle={styles.number}
          style={error ? { borderColor: tokens.colors.error } : undefined}
          value={formatPhoneDraft(value)}
          placeholder={examplePhone(value.region)}
          editable={!disabled}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          accessibilityLabel={label}
          onChangeText={(text) => onChange(nextPhoneDraft(value, text))}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  requiredMark: { color: tokens.colors.error, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  country: { width: 112 },
  number: { flex: 1, width: undefined, minWidth: 0 },
  error: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, color: tokens.colors.error },
});
