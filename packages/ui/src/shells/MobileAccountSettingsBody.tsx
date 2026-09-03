import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  LayoutChangeEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon } from '../icons/MobileIcon';
import { MobileInput } from '../components/MobileInput';
import { MobileButton } from '../components/MobileButton';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';
import { MobileChangePasswordBody } from './MobileChangePasswordBody';

export interface MobileAccountProfile {
  name: string;
  initials: string;
  email: string;
  phone?: string;
}

export interface MobileAccountSettingsBodyProps {
  profile: MobileAccountProfile;
  onSignOut?: () => void;
  onNestedViewChange?: (active: boolean) => void;
}

export interface MobileAccountSettingsBodyHandle {
  handleBack: () => boolean;
}

type AccountView = 'main' | 'password';

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export const MobileAccountSettingsBody = forwardRef<
  MobileAccountSettingsBodyHandle,
  MobileAccountSettingsBodyProps
>(function MobileAccountSettingsBody({ profile, onSignOut, onNestedViewChange }, ref) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const [accountView, setAccountView] = useState<AccountView>('main');
  const [paneWidth, setPaneWidth] = useState(0);
  const [fullName, setFullName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifEnabled, setEmailNotifEnabled] = useState(true);
  const slideX = useSharedValue(0);

  const cardStyle = {
    backgroundColor: theme.card,
    borderColor: theme.border,
  };

  const openPasswordView = () => {
    setAccountView('password');
    if (paneWidth > 0) {
      slideX.value = withTiming(-paneWidth, { duration: 220 });
    }
    onNestedViewChange?.(true);
  };

  const closePasswordView = useCallback(() => {
    slideX.value = withTiming(0, { duration: 200 });
    setAccountView('main');
    onNestedViewChange?.(false);
  }, [onNestedViewChange, slideX]);

  useImperativeHandle(
    ref,
    () => ({
      handleBack: () => {
        if (accountView === 'password') {
          closePasswordView();
          return true;
        }
        return false;
      },
    }),
    [accountView, closePasswordView],
  );

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const handlePaneLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== paneWidth) {
      setPaneWidth(width);
      slideX.value = accountView === 'password' ? -width : 0;
    }
  };

  const handleSave = () => {
    Alert.alert(t.common.confirm, t.mobile.account.profileSaved);
  };

  return (
    <View style={styles.root} onLayout={handlePaneLayout}>
      {paneWidth > 0 ? (
        <View style={styles.slideClip}>
          <Animated.View
            style={[
              styles.slideRow,
              { width: paneWidth * 2 },
              slideStyle,
            ]}
          >
            <ScrollView
              style={{ width: paneWidth }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={accountView === 'main'}
            >
              <View style={[styles.profileHero, nativeElevation(1), cardStyle]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{profile.initials}</Text>
                </View>
                <Text style={[styles.profileName, { color: theme.textHeading }]}>{fullName}</Text>
                <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{email}</Text>
                <View style={styles.editBtnWrap}>
                  <MobileButton
                    variant="outline"
                    onPress={() => Alert.alert(t.mobile.account.editProfile, t.mobile.account.editProfileHint)}
                  >
                    {t.mobile.account.editProfile}
                  </MobileButton>
                </View>
              </View>

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {t.mobile.account.personalInfo}
              </Text>
              <View style={[styles.card, nativeElevation(1), cardStyle]}>
                <MobileInput
                  label={t.mobile.account.fullName}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder={t.mobile.account.fullName}
                />
                <View style={styles.fieldGap} />
                <MobileInput
                  label={t.mobile.account.email}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder={t.mobile.account.email}
                />
                <View style={styles.fieldGap} />
                <MobileInput
                  label={t.mobile.account.phone}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder={t.mobile.account.phone}
                />
                <View style={styles.saveBtnWrap}>
                  <MobileButton onPress={handleSave}>{t.common.save}</MobileButton>
                </View>
              </View>

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {t.mobile.account.security}
              </Text>
              <View style={[styles.card, nativeElevation(1), cardStyle]}>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={openPasswordView}
                  activeOpacity={0.7}
                >
                  <MobileIcon name="shield" size={20} color={tokens.colors.accent} />
                  <Text style={[styles.actionLabel, { color: theme.textHeading }]}>
                    {t.mobile.account.changePassword}
                  </Text>
                  <MobileIcon name="chevron-right" size={18} tone="muted" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {t.mobile.account.notifications}
              </Text>
              <View style={[styles.card, nativeElevation(1), cardStyle]}>
                <View style={styles.toggleRow}>
                  <MobileIcon name="bell" size={20} color={tokens.colors.roles.services} />
                  <Text style={[styles.actionLabel, { color: theme.textHeading }]}>
                    {t.mobile.account.pushNotifications}
                  </Text>
                  <Switch
                    value={pushEnabled}
                    onValueChange={setPushEnabled}
                    trackColor={{ false: tokens.colors.divider, true: tokens.colors.roles.tenant }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <View style={[styles.rowDivider, { borderTopColor: theme.border }]} />
                <View style={styles.toggleRow}>
                  <MobileIcon name="chat" size={20} color={tokens.colors.accent} />
                  <Text style={[styles.actionLabel, { color: theme.textHeading }]}>
                    {t.mobile.account.emailNotifications}
                  </Text>
                  <Switch
                    value={emailNotifEnabled}
                    onValueChange={setEmailNotifEnabled}
                    trackColor={{ false: tokens.colors.divider, true: tokens.colors.roles.tenant }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.signOutBtn,
                  nativeElevation(1),
                  {
                    backgroundColor: theme.card,
                    borderColor: tokens.colors.danger,
                  },
                ]}
                onPress={onSignOut}
                activeOpacity={0.8}
              >
                <Text style={styles.signOutText}>{t.common.signOut}</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ width: paneWidth }}>
              <MobileChangePasswordBody />
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  slideClip: {
    flex: 1,
    overflow: 'hidden',
  },
  slideRow: {
    flexDirection: 'row',
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  profileHero: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingEn,
    fontSize: 22,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  profileName: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
  },
  profileEmail: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  editBtnWrap: {
    width: '100%',
    marginTop: 14,
  },
  sectionLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  fieldGap: {
    height: 12,
  },
  saveBtnWrap: {
    marginTop: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  actionLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  rowDivider: {
    borderTopWidth: 1,
    marginVertical: 4,
  },
  signOutBtn: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  signOutText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.danger,
  },
});
