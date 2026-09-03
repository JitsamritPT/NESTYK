import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileInput } from '../components/MobileInput';
import { MobileButton } from '../components/MobileButton';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';

const MIN_PASSWORD_LENGTH = 8;

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export const MobileChangePasswordBody: React.FC = () => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentError, setCurrentError] = useState<string | undefined>();
  const [newError, setNewError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const cardStyle = {
    backgroundColor: theme.card,
    borderColor: theme.border,
  };

  const handleSubmit = () => {
    let valid = true;
    setCurrentError(undefined);
    setNewError(undefined);
    setConfirmError(undefined);

    if (!currentPassword.trim()) {
      setCurrentError(t.mobile.account.password.required);
      valid = false;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setNewError(t.mobile.account.password.tooShort);
      valid = false;
    }
    if (newPassword !== confirmPassword) {
      setConfirmError(t.mobile.account.password.mismatch);
      valid = false;
    }
    if (!valid) return;

    Alert.alert(t.common.confirm, t.mobile.account.password.updated);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        {t.mobile.account.password.subtitle}
      </Text>

      <View style={[styles.card, nativeElevation(1), cardStyle]}>
        <MobileInput
          label={t.mobile.account.password.current}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.mobile.account.password.current}
          error={currentError}
        />
        <View style={styles.fieldGap} />
        <MobileInput
          label={t.mobile.account.password.new}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.mobile.account.password.new}
          error={newError}
          helperText={!newError ? t.mobile.account.password.requirements : undefined}
        />
        <View style={styles.fieldGap} />
        <MobileInput
          label={t.mobile.account.password.confirm}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={t.mobile.account.password.confirm}
          error={confirmError}
        />
        <View style={styles.submitWrap}>
          <MobileButton onPress={handleSubmit}>{t.mobile.account.password.submit}</MobileButton>
        </View>
      </View>

      <Text style={[styles.footerNote, { color: theme.textSecondary }]}>
        {t.mobile.account.changePasswordHint}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  hint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  fieldGap: {
    height: 12,
  },
  submitWrap: {
    marginTop: 16,
  },
  footerNote: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    textAlign: 'center',
  },
});
