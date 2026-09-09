import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  useWindowDimensions,
  BackHandler,
} from 'react-native';
import { MobileNestykLogo } from '../components/MobileNestykLogo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale, SupportedLocale } from '@nestyk/i18n';
import { UserRole } from '@nestyk/types';
import { MobileIcon } from '../icons/MobileIcon';
import { AppIconName } from '../icons/types';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';
import { MobileAccountSettingsBody, MobileAccountSettingsBodyHandle } from './MobileAccountSettingsBody';
import {
  DrawerMenuAction,
  DrawerMenuItem,
  getDrawerMenuForRole,
} from '../config/mobileDrawerMenuMatrix';

type DrawerSubView = 'language' | 'account' | 'roleMenu';

const PANEL_MARGIN = 12;
const PANEL_RADIUS = 28;

export interface MobileProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userPhone?: string;
  initials: string;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onSignOut?: () => void;
  onMenuAction?: (action: DrawerMenuAction) => void;
}

const ROLE_OPTIONS: { key: UserRole; icon: AppIconName }[] = [
  { key: 'guest', icon: 'search' },
  { key: 'tenant', icon: 'home' },
  { key: 'owner', icon: 'key' },
  { key: 'agent', icon: 'handshake' },
  { key: 'admin', icon: 'shield' },
];

const LOCALE_OPTIONS: SupportedLocale[] = ['th', 'en', 'zh', 'ja'];

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export const MobileProfileDrawer: React.FC<MobileProfileDrawerProps> = ({
  visible,
  onClose,
  userName,
  userEmail,
  userPhone,
  initials,
  activeRole,
  onRoleChange,
  onSignOut,
  onMenuAction,
}) => {
  const { t, locale, setLocale } = useLocale();
  const { theme, themeMode, setThemeMode, isDark } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const panelWidth = Math.max(windowWidth - PANEL_MARGIN * 2, 0);
  const slideDistance = panelWidth + PANEL_MARGIN;

  const roleColor = tokens.colors.roles[activeRole] || tokens.colors.brand[500];
  const roleSubtitleMap: Record<UserRole, string> = {
    guest: t.roles.guestSubtitle,
    tenant: t.roles.tenantSubtitle,
    owner: t.roles.ownerSubtitle,
    agent: t.roles.agentSubtitle,
    admin: t.roles.adminSubtitle,
  };
  const [mounted, setMounted] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | DrawerSubView>('main');
  const [accountNested, setAccountNested] = useState(false);
  const [submenuParent, setSubmenuParent] = useState<DrawerMenuItem | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const accountRef = useRef<MobileAccountSettingsBodyHandle>(null);
  const translateX = useSharedValue(-slideDistance);
  const overlayOpacity = useSharedValue(0);
  const contentSlideX = useSharedValue(0);
  const contentWidth = panelWidth - 28;

  const drawerSections = getDrawerMenuForRole(activeRole);

  const openSubView = (view: DrawerSubView) => {
    setSettingsView(view);
    contentSlideX.value = withTiming(-contentWidth, { duration: 220 });
  };

  const closeSubView = () => {
    contentSlideX.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setSettingsView)('main');
        runOnJS(setSubmenuParent)(null);
      }
    });
    setAccountNested(false);
  };

  const handleSubBack = () => {
    if (settingsView === 'account' && accountRef.current?.handleBack()) {
      return;
    }
    closeSubView();
  };

  const handleSignOut = () => {
    onSignOut?.();
    onClose();
  };

  const dispatchMenuAction = (action?: DrawerMenuAction) => {
    if (!action) return;
    onMenuAction?.(action);
    onClose();
  };

  const handleMenuItemPress = (item: DrawerMenuItem) => {
    if (item.children && item.children.length > 0) {
      const presentation = item.presentation ?? 'expand';
      if (presentation === 'expand') {
        setExpandedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }));
        return;
      }
      setSubmenuParent(item);
      openSubView('roleMenu');
      return;
    }
    dispatchMenuAction(item.action);
  };

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateX.value = withTiming(0, { duration: 250 });
      overlayOpacity.value = withTiming(1, { duration: 200 });
    } else if (mounted) {
      translateX.value = withTiming(-slideDistance, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      overlayOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [visible, mounted, slideDistance, translateX, overlayOpacity]);

  useEffect(() => {
    if (!visible) {
      setSettingsView('main');
      setAccountNested(false);
      setSubmenuParent(null);
      setExpandedIds({});
      contentSlideX.value = 0;
    }
  }, [visible, contentSlideX]);

  useEffect(() => {
    setExpandedIds({});
    setSubmenuParent(null);
    if (settingsView === 'roleMenu') {
      setSettingsView('main');
      contentSlideX.value = 0;
    }
  }, [activeRole]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settingsView !== 'main') {
        handleSubBack();
        return true;
      }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose, settingsView]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const contentSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentSlideX.value }],
  }));

  const subViewTitle =
    settingsView === 'language'
      ? t.mobile.settings.language
      : settingsView === 'roleMenu' && submenuParent
        ? t.mobile.drawerMenu[submenuParent.labelKey]
        : settingsView === 'account' && accountNested
          ? t.mobile.account.changePassword
          : t.mobile.account.title;

  const currentLanguageLabel = t.mobile.settings.languageNames[locale];

  const renderMenuRow = (item: DrawerMenuItem, opts?: { nested?: boolean; isLast?: boolean }) => {
    const hasChildren = Boolean(item.children?.length);
    const isExpanded = Boolean(expandedIds[item.id]);

    return (
      <View key={item.id}>
        <TouchableOpacity
          style={[
            styles.settingRow,
            opts?.nested && styles.menuNestedRow,
            !opts?.isLast && !isExpanded && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
          ]}
          onPress={() => handleMenuItemPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t.mobile.drawerMenu[item.labelKey]}
        >
          <MobileIcon
            name={item.icon}
            size={opts?.nested ? 18 : 20}
            color={opts?.nested ? theme.textSecondary : roleColor}
          />
          <Text style={[styles.navLabel, { color: theme.textHeading }]}>
            {t.mobile.drawerMenu[item.labelKey]}
          </Text>
          {hasChildren ? (
            <MobileIcon
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={18}
              tone="muted"
            />
          ) : null}
        </TouchableOpacity>
        {hasChildren && (item.presentation ?? 'expand') === 'expand' && isExpanded
          ? item.children!.map((child, index) =>
              renderMenuRow(child, {
                nested: true,
                isLast: index === item.children!.length - 1,
              }),
            )
          : null}
      </View>
    );
  };

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.overlay, overlayStyle, { backgroundColor: theme.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            nativeElevation(3),
            drawerStyle,
            {
              width: panelWidth,
              top: Math.max(insets.top, 8) + 4,
              bottom: Math.max(insets.bottom, 8) + 8,
              backgroundColor: theme.background,
            },
          ]}
        >
          <View style={[styles.panelBody, { width: contentWidth }]}>
            <Animated.View
              style={[
                styles.slideRow,
                { width: contentWidth * 2 },
                contentSlideStyle,
              ]}
            >
              <ScrollView
                style={[styles.scroll, { width: contentWidth }]}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                scrollEnabled={settingsView === 'main'}
              >
            <View style={[styles.heroCard, { backgroundColor: roleColor }]}>
              <View>
                <MobileNestykLogo
                  variant={activeRole === 'guest' ? 'wordmark' : 'wordmarkOnDark'}
                  height={26}
                />
                <Text style={styles.heroSubtitle}>{t.mobile.profile.hubSubtitle}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              >
                <MobileIcon name="chevron-left" size={20} tone="active" />
              </TouchableOpacity>
            </View>

            <View style={[styles.profileCard, nativeElevation(1), { backgroundColor: theme.card }]}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{initials}</Text>
              </View>
              <View style={styles.profileText}>
                <Text style={[styles.profileName, { color: theme.textHeading }]}>{userName}</Text>
                <Text style={[styles.profileSub, { color: theme.textSecondary }]}>
                  {roleSubtitleMap[activeRole]}
                </Text>
              </View>
              <MobileIcon name="dots-vertical" size={20} tone="muted" />
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {t.mobile.profile.switchRole}
            </Text>
            <View style={styles.roleGrid}>
              {ROLE_OPTIONS.map((role) => {
                const isActive = activeRole === role.key;
                const color = tokens.colors.roles[role.key] || tokens.colors.brand[500];
                return (
                  <TouchableOpacity
                    key={role.key}
                    style={[
                      styles.roleChip,
                      { borderColor: theme.border, backgroundColor: isDark ? theme.card : '#FFFFFF' },
                      isActive && { backgroundColor: color, borderColor: color },
                    ]}
                    onPress={() => onRoleChange(role.key)}
                    activeOpacity={0.8}
                  >
                    <MobileIcon
                      name={role.icon}
                      size={14}
                      color={isActive ? (role.key === 'guest' ? tokens.colors.primary : '#FFFFFF') : tokens.colors.icon.secondary}
                      weight={isActive ? 'bold' : 'regular'}
                    />
                    <Text
                      style={[
                        styles.roleChipLabel,
                        isActive && {
                          color: role.key === 'guest' ? tokens.colors.primary : '#FFFFFF',
                        },
                      ]}
                    >
                      {t.roles[role.key]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {drawerSections.map((section) => (
              <View key={section.titleKey ?? 'workspace'}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  {t.mobile.drawerMenu[section.titleKey ?? 'sectionTitle']}
                </Text>
                <View style={[styles.settingsCard, nativeElevation(1), { backgroundColor: theme.card }]}>
                  {section.items.map((item, index) =>
                    renderMenuRow(item, { isLast: index === section.items.length - 1 }),
                  )}
                </View>
              </View>
            ))}

            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {t.mobile.profile.settings}
            </Text>
            <View style={[styles.settingsCard, nativeElevation(1), { backgroundColor: theme.card }]}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => openSubView('account')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t.mobile.profile.accountSettings}
              >
                <MobileIcon name="gear" size={20} color={theme.textSecondary} />
                <Text style={[styles.navLabel, { color: theme.textHeading }]}>
                  {t.mobile.profile.accountSettings}
                </Text>
                <MobileIcon name="chevron-right" size={18} tone="muted" />
              </TouchableOpacity>
              <View style={[styles.settingRow, styles.settingRowBorder, { borderTopColor: theme.border }]}>
                <MobileIcon name="moon" size={20} color={theme.textSecondary} />
                <Text style={[styles.navLabel, { color: theme.textHeading }]}>
                  {t.mobile.settings.darkMode}
                </Text>
                <Switch
                  value={themeMode === 'dark'}
                  onValueChange={(value) => setThemeMode(value ? 'dark' : 'light')}
                  trackColor={{ false: tokens.colors.divider, true: tokens.colors.roles.tenant }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <TouchableOpacity
                style={[styles.settingRow, styles.settingRowBorder, { borderTopColor: theme.border }]}
                onPress={() => openSubView('language')}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t.mobile.settings.language}
              >
                <MobileIcon name="globe" size={20} color={theme.textSecondary} />
                <Text style={[styles.navLabel, { color: theme.textHeading }]}>
                  {t.mobile.settings.language}
                </Text>
                <Text style={[styles.settingValue, { color: theme.textSecondary }]}>
                  {currentLanguageLabel}
                </Text>
                <MobileIcon name="chevron-right" size={18} tone="muted" />
              </TouchableOpacity>
            </View>
              </ScrollView>

              <View style={[styles.subPane, { width: contentWidth, backgroundColor: theme.background }]}>
                <View style={styles.subHeader}>
                  <TouchableOpacity
                    style={[styles.subBackBtn, { backgroundColor: isDark ? theme.card : '#FFFFFF' }]}
                    onPress={handleSubBack}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                  >
                    <MobileIcon name="chevron-left" size={20} tone="active" />
                  </TouchableOpacity>
                  <Text style={[styles.subTitle, { color: theme.textHeading }]}>{subViewTitle}</Text>
                </View>

                {settingsView === 'language' ? (
                  <View style={[styles.languageList, nativeElevation(1), { backgroundColor: theme.card }]}>
                    {LOCALE_OPTIONS.map((option, index) => {
                      const isActive = locale === option;
                      const isLast = index === LOCALE_OPTIONS.length - 1;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.languageOption,
                            !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
                            isActive && {
                              backgroundColor: isDark ? '#334155' : '#FFFBEB',
                            },
                          ]}
                          onPress={() => {
                            setLocale(option);
                            closeSubView();
                          }}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.languageOptionLabel,
                              { color: theme.textHeading },
                              isActive && { color: tokens.colors.primary, fontWeight: '700' },
                            ]}
                          >
                            {t.mobile.settings.languageNames[option]}
                          </Text>
                          {isActive ? (
                            <MobileIcon name="check" size={20} color={tokens.colors.brand[500]} weight="bold" />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : settingsView === 'account' ? (
                  <MobileAccountSettingsBody
                    ref={accountRef}
                    profile={{
                      name: userName,
                      initials,
                      email: userEmail,
                      phone: userPhone,
                    }}
                    onSignOut={handleSignOut}
                    onNestedViewChange={setAccountNested}
                  />
                ) : settingsView === 'roleMenu' && submenuParent?.children ? (
                  <View style={[styles.languageList, nativeElevation(1), { backgroundColor: theme.card }]}>
                    {submenuParent.children.map((child, index) => {
                      const isLast = index === submenuParent.children!.length - 1;
                      return (
                        <TouchableOpacity
                          key={child.id}
                          style={[
                            styles.settingRow,
                            !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
                          ]}
                          onPress={() => dispatchMenuAction(child.action)}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={t.mobile.drawerMenu[child.labelKey]}
                        >
                          <MobileIcon name={child.icon} size={20} color={roleColor} />
                          <Text style={[styles.navLabel, { color: theme.textHeading }]}>
                            {t.mobile.drawerMenu[child.labelKey]}
                          </Text>
                          <MobileIcon name="chevron-right" size={18} tone="muted" />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  panel: {
    position: 'absolute',
    left: PANEL_MARGIN,
    borderRadius: PANEL_RADIUS,
    overflow: 'hidden',
  },
  panelBody: {
    flex: 1,
    marginHorizontal: 14,
    overflow: 'hidden',
  },
  slideRow: {
    flexDirection: 'row',
    flex: 1,
  },
  scroll: {
    flex: 1,
    borderRadius: PANEL_RADIUS,
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 20,
  },
  heroCard: {
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 18,
    minHeight: 108,
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: tokens.colors.primary,
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: -1,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: tokens.colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontFamily: tokens.typography.native.headingEn,
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  profileSub: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  moreBtn: {
    fontSize: 20,
    color: tokens.colors.textSecondary,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: tokens.colors.textSecondary,
    marginBottom: 10,
    marginTop: 14,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleChipEmoji: {
    fontSize: 12,
  },
  roleChipLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    fontWeight: '500',
    color: tokens.colors.textSecondary,
  },
  navLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 20,
    color: tokens.colors.textHeading,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 18,
    color: tokens.colors.placeholder,
  },
  settingsCard: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  menuNestedRow: {
    paddingLeft: 16,
  },
  settingRowBorder: {
    borderTopWidth: 1,
  },
  settingValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginRight: 2,
  },
  subPane: {
    paddingTop: 14,
    flex: 1,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingTop: 6,
  },
  subBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTitle: {
    flex: 1,
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  languageList: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  languageOptionLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});
