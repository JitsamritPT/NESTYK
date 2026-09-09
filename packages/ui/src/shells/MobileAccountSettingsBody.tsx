import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
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
import { AppIconName } from '../icons/types';
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
  onNestedViewChange?: (active: boolean, title?: string) => void;
  appVersion?: string;
}

export interface MobileAccountSettingsBodyHandle {
  handleBack: () => boolean;
}

type SettingsView =
  | 'hub'
  | 'profile'
  | 'password'
  | 'about'
  | 'terms'
  | 'privacy'
  | 'faq'
  | 'support';

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export const MobileAccountSettingsBody = forwardRef<
  MobileAccountSettingsBodyHandle,
  MobileAccountSettingsBodyProps
>(function MobileAccountSettingsBody({
  profile,
  onSignOut,
  onNestedViewChange,
  appVersion = '0.1.0',
}, ref) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const [settingsView, setSettingsView] = useState<SettingsView>('hub');
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

  const nestedTitleFor = useCallback(
    (view: SettingsView): string | undefined => {
      switch (view) {
        case 'profile':
          return t.mobile.appSettings.profileAndContact;
        case 'password':
          return t.mobile.account.changePassword;
        case 'about':
          return t.mobile.appSettings.aboutNestyk;
        case 'terms':
          return t.mobile.appSettings.terms;
        case 'privacy':
          return t.mobile.appSettings.privacy;
        case 'faq':
          return t.mobile.appSettings.faq;
        case 'support':
          return t.mobile.appSettings.contactSupport;
        default:
          return undefined;
      }
    },
    [t],
  );

  const openNested = (view: Exclude<SettingsView, 'hub'>) => {
    setSettingsView(view);
    if (paneWidth > 0) {
      slideX.value = withTiming(-paneWidth, { duration: 220 });
    }
    onNestedViewChange?.(true, nestedTitleFor(view));
  };

  const closeNested = useCallback(() => {
    slideX.value = withTiming(0, { duration: 200 });
    setSettingsView('hub');
    onNestedViewChange?.(false);
  }, [onNestedViewChange, slideX]);

  useImperativeHandle(
    ref,
    () => ({
      handleBack: () => {
        if (settingsView !== 'hub') {
          closeNested();
          return true;
        }
        return false;
      },
    }),
    [settingsView, closeNested],
  );

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const handlePaneLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== paneWidth) {
      setPaneWidth(width);
      slideX.value = settingsView !== 'hub' ? -width : 0;
    }
  };

  const handleSave = () => {
    Alert.alert(t.common.confirm, t.mobile.account.profileSaved);
  };

  const renderLinkRow = (
    label: string,
    icon: AppIconName,
    onPress: () => void,
    opts?: { isLast?: boolean },
  ) => (
    <TouchableOpacity
      style={[
        styles.actionRow,
        !opts?.isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MobileIcon name={icon} size={20} color={tokens.colors.icon.secondary} />
      <Text style={[styles.actionLabel, { color: theme.textHeading }]}>{label}</Text>
      <MobileIcon name="chevron-right" size={18} color={tokens.colors.icon.secondary} />
    </TouchableOpacity>
  );

  const renderInfoBody = (body: string) => (
    <ScrollView
      style={{ width: paneWidth }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, nativeElevation(1), cardStyle]}>
        <Text style={[styles.infoBody, { color: theme.textSecondary }]}>{body}</Text>
      </View>
    </ScrollView>
  );

  const renderNestedPane = () => {
    switch (settingsView) {
      case 'profile':
        return (
          <ScrollView
            style={{ width: paneWidth }}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.profileHero, nativeElevation(1), cardStyle]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile.initials}</Text>
              </View>
              <Text style={[styles.profileName, { color: theme.textHeading }]}>{fullName}</Text>
              <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{email}</Text>
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
          </ScrollView>
        );
      case 'password':
        return (
          <View style={{ width: paneWidth, flex: 1 }}>
            <MobileChangePasswordBody />
          </View>
        );
      case 'about':
        return renderInfoBody(t.mobile.appSettings.aboutBody);
      case 'terms':
        return renderInfoBody(t.mobile.appSettings.termsBody);
      case 'privacy':
        return renderInfoBody(t.mobile.appSettings.privacyBody);
      case 'faq':
        return renderInfoBody(t.mobile.appSettings.faqBody);
      case 'support':
        return renderInfoBody(t.mobile.appSettings.supportBody);
      default:
        return <View style={{ width: paneWidth }} />;
    }
  };

  return (
    <View style={styles.root} onLayout={handlePaneLayout}>
      {paneWidth > 0 ? (
        <View style={styles.slideClip}>
          <Animated.View style={[styles.slideRow, { width: paneWidth * 2 }, slideStyle]}>
            <ScrollView
              style={{ width: paneWidth }}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              scrollEnabled={settingsView === 'hub'}
            >
              <View style={[styles.profileHero, nativeElevation(1), cardStyle]}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{profile.initials}</Text>
                </View>
                <Text style={[styles.profileName, { color: theme.textHeading }]}>{profile.name}</Text>
                <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{profile.email}</Text>
              </View>

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {t.mobile.appSettings.accountSection}
              </Text>
              <View style={[styles.card, styles.cardFlush, nativeElevation(1), cardStyle]}>
                {renderLinkRow(
                  t.mobile.appSettings.profileAndContact,
                  'user',
                  () => openNested('profile'),
                )}
                {renderLinkRow(
                  t.mobile.account.changePassword,
                  'shield',
                  () => openNested('password'),
                  { isLast: true },
                )}
              </View>

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {t.mobile.account.notifications}
              </Text>
              <View style={[styles.card, nativeElevation(1), cardStyle]}>
                <View style={styles.toggleRow}>
                  <MobileIcon name="bell" size={20} color={tokens.colors.icon.secondary} />
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
                  <MobileIcon name="chat" size={20} color={tokens.colors.icon.secondary} />
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

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {t.mobile.appSettings.helpSection}
              </Text>
              <View style={[styles.card, styles.cardFlush, nativeElevation(1), cardStyle]}>
                {renderLinkRow(t.mobile.appSettings.faq, 'chat', () => openNested('faq'))}
                {renderLinkRow(
                  t.mobile.appSettings.contactSupport,
                  'siren',
                  () => openNested('support'),
                  { isLast: true },
                )}
              </View>

              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                {t.mobile.appSettings.aboutSection}
              </Text>
              <View style={[styles.card, styles.cardFlush, nativeElevation(1), cardStyle]}>
                {renderLinkRow(
                  t.mobile.appSettings.aboutNestyk,
                  'sparkle',
                  () => openNested('about'),
                )}
                {renderLinkRow(t.mobile.appSettings.terms, 'clipboard', () => openNested('terms'))}
                {renderLinkRow(t.mobile.appSettings.privacy, 'shield', () => openNested('privacy'))}
                <View style={[styles.versionRow, { borderTopColor: theme.border }]}>
                  <MobileIcon name="package" size={20} color={tokens.colors.icon.secondary} />
                  <Text style={[styles.actionLabel, { color: theme.textHeading }]}>
                    {t.mobile.appSettings.version}
                  </Text>
                  <Text style={[styles.versionValue, { color: theme.textSecondary }]}>{appVersion}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.signOutBtn,
                  nativeElevation(1),
                  { backgroundColor: theme.card, borderColor: tokens.colors.danger },
                ]}
                onPress={onSignOut}
                activeOpacity={0.8}
              >
                <Text style={styles.signOutText}>{t.common.signOut}</Text>
              </TouchableOpacity>
            </ScrollView>

            {renderNestedPane()}
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarText: {
    fontFamily: tokens.typography.native.headingEn,
    fontSize: 20,
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
  cardFlush: {
    paddingVertical: 2,
    paddingHorizontal: 12,
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
    paddingVertical: 12,
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
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  versionValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  infoBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
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
