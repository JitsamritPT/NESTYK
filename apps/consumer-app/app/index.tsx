import { AgentLeadsScreen } from '../components/AgentLeadsScreen';
import { AgentRoomsScreen } from '../components/AgentRoomsScreen';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Alert, BackHandler } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useLocale } from '@nestyk/i18n';
import {
  MobileModePage,
  MobileButton,
  MobileBadge,
  MobileInput,
  MobileBottomTabBar,
  MobileHeaderActions,
  MobileWorkspaceHeader,
  MobileSectionHeader,
  MobileProfileDrawer,
  MobileNotificationsPanel,
  MobileNotificationsBody,
  MobileAppTab,
  MobileIcon,
  useMobileTheme,
  getDefaultTabForRole,
  tokens,
} from '@nestyk/ui/native';
import { UserRole } from '@nestyk/types';
import {
  MobileCreateListingWizardBody,
  MobileAgentDashboardBody,
  createAgentDashboardDemoFixture,
  defaultOwnerListingConfig,
  defaultAgentListingConfig,
  type AgentDashboardDeepLink,
} from '@nestyk/feature-listing';
import { MobileServiceCatalogBody } from '@nestyk/feature-services';
import { createAgentScoutRoom, fetchAgentContacts, fetchAgentPropertyTypes, fetchAgentContractTypes, fetchAgentRoomTypes, fetchAgentFacilities } from '../lib/agent-listings-api';
import { pickRoomPhotos, uploadRoomPhoto, enhanceRoomPhoto } from '../lib/room-photos';
import { searchPlaces, getPlaceDetails, searchNearbyPlaces } from '../lib/places-api';
import { useAuth } from '../lib/auth/AuthContext';
import { APP_CONFIG } from '../lib/config';
import {
  consumeGuestBrowse,
  consumePendingRole,
  roleRequiresAuth,
  setPendingRole,
} from '../lib/auth/role-gate';
import {
  MOCK_LISTINGS,
  MOCK_ACTIVITY_NOTIFICATIONS,
  MOCK_MESSAGE_NOTIFICATIONS,
  MOCK_SERVICE_TICKETS,
} from '../lib/mock-data';

function getScreenTitle(tab: MobileAppTab, t: ReturnType<typeof useLocale>['t']): string {
  switch (tab) {
    case 'home':
      return t.mobile.screens.home;
    case 'search':
      return t.mobile.screens.discover;
    case 'living':
      return t.mobile.screens.living;
    case 'bills':
      return t.mobile.screens.bills;
    case 'dashboard':
      return t.mobile.screens.dashboard;
    case 'listings':
      return t.mobile.screens.listings;
    case 'listingRoom':
      return t.mobile.screens.listingRoom;
    case 'createListing':
      return t.mobile.screens.createListing;
    case 'listingLead':
      return t.agent.leads.title;
    case 'clients':
      return t.mobile.screens.clients;
    case 'more':
      return t.mobile.screens.more;
    case 'contact':
      return t.mobile.screens.contact;
    case 'contracts':
      return t.mobile.screens.contracts;
    case 'calendar':
      return t.mobile.screens.calendar;
    case 'income':
      return t.mobile.screens.income;
    case 'deals':
      return t.mobile.screens.deals;
    case 'tickets':
      return t.mobile.screens.tickets;
    case 'services':
      return t.mobile.screens.services;
    default:
      return t.mobile.screens.home;
  }
}

export default function AppHomeScreen() {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const router = useRouter();
  const { ready, isAuthenticated, session, displayName, initials, signOut } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRole>(APP_CONFIG.defaultRole);
  const [activeTab, setActiveTab] = useState<MobileAppTab>(() =>
    getDefaultTabForRole(APP_CONFIG.defaultRole),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_ACTIVITY_NOTIFICATIONS);
  const [messages, setMessages] = useState(MOCK_MESSAGE_NOTIFICATIONS);
  /** Dashboard deep-link: open create-lead form once. */
  const [leadsOpenCreate, setLeadsOpenCreate] = useState(false);
  const [leadsWorkFilter, setLeadsWorkFilter] = useState<'lead_follow_up' | null>(null);
  const [clientsWorkFilter, setClientsWorkFilter] = useState<
    'overdue_payment' | 'awaiting_signature' | 'renewal' | 'lead_follow_up' | null
  >(null);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [pageRefreshing, setPageRefreshing] = useState(false);
  const refreshSequence = useRef(0);
  const pendingRefresh = useRef<number | null>(null);
  const [leadsReloadToken, setLeadsReloadToken] = useState(0);
  const [roomsReloadToken, setRoomsReloadToken] = useState(0);
  const [leadsSearchOpen, setLeadsSearchOpen] = useState(false);
  const [roomsSearchOpen, setRoomsSearchOpen] = useState(false);
  const [clientsSearchOpen, setClientsSearchOpen] = useState(false);
  const [clientsQuery, setClientsQuery] = useState('');
  /** Where header/hardware back should return from secondary screens (e.g. create listing). */
  const [secondaryReturnTab, setSecondaryReturnTab] = useState<MobileAppTab | null>(null);

  const unreadCount = [...notifications, ...messages].filter((n) => n.unread).length;

  const handleSearchPlaces = useCallback(
    (query: string) => searchPlaces(query, locale),
    [locale],
  );
  const handleGetPlaceDetails = useCallback(
    (placeId: string) => getPlaceDetails(placeId, locale),
    [locale],
  );
  const handleListContacts = useCallback(() => fetchAgentContacts(), []);
  const handleListPropertyTypes = useCallback(() => fetchAgentPropertyTypes(), []);
  const handleListContractTypes = useCallback(() => fetchAgentContractTypes(), []);
  const handleListRoomTypes = useCallback(() => fetchAgentRoomTypes(), []);

  const handleDeepLinkUrl = (url: string | null) => {
    if (!url) return;
    const parsed = Linking.parse(url);
    const hostOrPath = (parsed.hostname || parsed.path || '').toLowerCase();

    if (hostOrPath.includes('tenant')) {
      setActiveRole('tenant');
      setActiveTab('dashboard');
    } else if (hostOrPath.includes('owner')) {
      setActiveRole('owner');
      setActiveTab('dashboard');
    } else if (hostOrPath.includes('agent')) {
      setActiveRole('agent');
      setActiveTab('dashboard');
    } else if (hostOrPath.includes('admin')) {
      setActiveRole('admin');
      setActiveTab('dashboard');
    } else if (hostOrPath.includes('services')) {
      setActiveTab('services');
    } else if (hostOrPath.includes('guest') || hostOrPath.includes('search')) {
      setActiveRole('guest');
      setActiveTab('home');
    } else if (hostOrPath.includes('viewing')) {
      Alert.alert('Schedule Viewing', `Open viewing request from link: ${url}`);
    }
  };

  useEffect(() => {
    Linking.getInitialURL().then(handleDeepLinkUrl);
    const subscription = Linking.addEventListener('url', (event) => handleDeepLinkUrl(event.url));
    return () => subscription.remove();
  }, []);


  const handleTabPress = (tab: MobileAppTab) => {
    if (tab === 'menu') {
      setDrawerOpen(true);
      return;
    }
    setLeadsOpenCreate(false);
    if (tab !== 'listingLead') setLeadsWorkFilter(null);
    if (tab !== 'clients') setClientsWorkFilter(null);
    setSecondaryReturnTab(null);
    setActiveTab(tab);
  };

  const openCreateListing = useCallback(() => {
    if (activeTab !== 'createListing') {
      setSecondaryReturnTab(activeTab);
    }
    setActiveTab('createListing');
  }, [activeTab]);

  const goBackFromSecondary = useCallback(() => {
    const fallback: MobileAppTab = activeRole === 'owner' ? 'listings' : 'listingRoom';
    const target =
      secondaryReturnTab && secondaryReturnTab !== 'createListing'
        ? secondaryReturnTab
        : fallback;
    setSecondaryReturnTab(null);
    setActiveTab(target);
  }, [activeRole, secondaryReturnTab]);

  useEffect(() => {
    if (activeTab !== 'createListing') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goBackFromSecondary();
      return true;
    });
    return () => sub.remove();
  }, [activeTab, goBackFromSecondary]);

  const handleRoleChange = (role: UserRole) => {
    if (roleRequiresAuth(role) && !isAuthenticated) {
      setPendingRole(role);
      setDrawerOpen(false);
      router.push('/login');
      return;
    }
    setActiveRole(role);
    setActiveTab(getDefaultTabForRole(role));
  };

  // Seeker (guest) is public; every other role requires login.
  useEffect(() => {
    if (!ready) return;

    if (isAuthenticated) {
      const pending = consumePendingRole();
      if (pending && roleRequiresAuth(pending)) {
        setActiveRole(pending);
        setActiveTab(getDefaultTabForRole(pending));
      }
      return;
    }

    if (consumeGuestBrowse()) {
      setActiveRole('guest');
      setActiveTab(getDefaultTabForRole('guest'));
      return;
    }

    if (roleRequiresAuth(activeRole)) {
      router.replace('/login');
    }
  }, [ready, isAuthenticated, activeRole, router]);

  const accentColor =
    tokens.colors.roles[activeRole as keyof typeof tokens.colors.roles] || tokens.colors.accent;

  const cardStyle = {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
  };

  const headingText = { color: theme.textHeading };
  const secondaryText = { color: theme.textSecondary };

  const screenTitle =
    activeRole === 'agent'
      ? undefined
      : getScreenTitle(activeTab, t);

  const agentSectionTabs: MobileAppTab[] = [
    'listingRoom',
    'listingLead',
    'clients',
    'more',
    'contact',
    'contracts',
    'calendar',
    'services',
    'createListing',
  ];

  useEffect(() => {
    setLeadsSearchOpen(false);
    setRoomsSearchOpen(false);
    setClientsSearchOpen(false);
    setClientsQuery('');
  }, [activeTab]);

  const renderAgentHeader = () => {
    const workspace = t.agent.dashboard.workspaceLabel;
    const accent = tokens.colors.roles.agent;
    const openMenu = () => setDrawerOpen(true);

    if (activeTab === 'dashboard') {
      return (
        <MobileWorkspaceHeader
          workspaceLabel={workspace}
          accentColor={accent}
          notificationCount={unreadCount}
          onMenuPress={openMenu}
          onNotificationsPress={() => setNotificationsOpen(true)}
        />
      );
    }

    if (agentSectionTabs.includes(activeTab)) {
      const isSecondary = activeTab === 'createListing';
      const showSearch =
        !isSecondary &&
        (activeTab === 'listingRoom' ||
          activeTab === 'listingLead' ||
          activeTab === 'clients');
      const searchActive =
        (activeTab === 'listingLead' && leadsSearchOpen) ||
        (activeTab === 'listingRoom' && roomsSearchOpen) ||
        (activeTab === 'clients' && clientsSearchOpen);

      return (
        <MobileSectionHeader
          title={getScreenTitle(activeTab, t)}
          workspaceLabel={isSecondary ? undefined : workspace}
          accentColor={accent}
          leading={isSecondary ? 'back' : 'menu'}
          onMenuPress={openMenu}
          onBackPress={isSecondary ? goBackFromSecondary : undefined}
          searchActive={searchActive}
          searchAccessibilityLabel={
            activeTab === 'listingLead'
              ? t.agent.leads.searchFilters
              : activeTab === 'listingRoom'
                ? t.agent.listings.search
                : t.agent.dashboard.clientsTitle
          }
          onSearchPress={
            showSearch
              ? () => {
                  if (activeTab === 'listingLead') setLeadsSearchOpen((v) => !v);
                  else if (activeTab === 'listingRoom') setRoomsSearchOpen((v) => !v);
                  else setClientsSearchOpen((v) => !v);
                }
              : undefined
          }
        />
      );
    }

    return (
      <MobileWorkspaceHeader
        workspaceLabel={workspace}
        accentColor={accent}
        notificationCount={unreadCount}
        onMenuPress={openMenu}
        onNotificationsPress={() => setNotificationsOpen(true)}
      />
    );
  };

  const handleAgentDashboardNavigate = useCallback(
    (link: AgentDashboardDeepLink) => {
      if (link.type === 'tab') {
        if (link.tab === 'listingLead') {
          setLeadsOpenCreate(link.filter?.kind === 'lead_create');
          setLeadsWorkFilter(link.filter?.kind === 'work' && link.filter.work === 'lead_follow_up' ? 'lead_follow_up' : null);
          setClientsWorkFilter(null);
        } else if (link.tab === 'clients') {
          setClientsWorkFilter(link.filter?.kind === 'work' ? link.filter.work : null);
          setLeadsOpenCreate(false);
          setLeadsWorkFilter(null);
        } else {
          setLeadsOpenCreate(false);
          setLeadsWorkFilter(null);
          setClientsWorkFilter(null);
        }
        setActiveTab(link.tab);
        return;
      }
      switch (link.id) {
        case 'addListing':
          openCreateListing();
          return;
        case 'newLead':
          setLeadsOpenCreate(true);
          setLeadsWorkFilter(null);
          setActiveTab('listingLead');
          return;
        case 'viewCalendar':
        case 'viewAppointment':
          setActiveTab('calendar');
          return;
        case 'viewCommission':
          Alert.alert(t.agent.dashboard.openCommission, t.agent.dashboard.unavailableSection);
          return;
        case 'viewPayments':
          setClientsWorkFilter('overdue_payment');
          setActiveTab('clients');
          return;
        case 'viewServices':
          setActiveTab('services');
          return;
        case 'viewContacts':
          setActiveTab('contact');
          return;
        case 'viewContracts':
          setActiveTab('contracts');
          return;
        case 'viewListing':
          setActiveTab('listingRoom');
          return;
        case 'viewLead':
          setActiveTab('listingLead');
          return;
        case 'viewClient':
          setActiveTab('clients');
          return;
        default:
          return;
      }
    },
    [t, openCreateListing],
  );

  const agentDashboardSnapshot = useMemo(() => {
    const dateLabel = new Date().toLocaleDateString(
      locale === 'th' ? 'th-TH' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-GB',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    );
    // Prefer a person-facing first name; avoid treating "Admin" as the role label.
    const raw = (displayName || '').trim();
    const first = raw.split(/\s+/)[0] || '';
    const greetingName =
      !first || first.toLowerCase() === 'admin' || raw === t.roles.guest
        ? (session?.email?.split('@')[0] || t.roles.agent)
        : first;
    return createAgentDashboardDemoFixture({
      greetingName,
      localDateLabel: dateLabel,
    });
  }, [displayName, locale, session?.email, t.roles.agent, t.roles.guest, dashboardRefreshKey]);

  const finishPageRefresh = useCallback((token: number) => {
    if (pendingRefresh.current !== token) return;
    pendingRefresh.current = null;
    setPageRefreshing(false);
  }, []);

  useEffect(() => {
    // A completion from a previous tab/role must never stop a newer refresh.
    pendingRefresh.current = null;
    setPageRefreshing(false);
  }, [activeRole, activeTab]);

  useEffect(() => {
    // Demo data is synchronous: finish after the new snapshot is committed.
    // Replace this with the dashboard request's settlement when its API is connected.
    if (activeRole === 'agent' && activeTab === 'dashboard' && dashboardRefreshKey > 0) {
      finishPageRefresh(dashboardRefreshKey);
    }
  }, [agentDashboardSnapshot, dashboardRefreshKey, activeRole, activeTab, finishPageRefresh]);

  const handlePageRefresh = useCallback(() => {
    if (pendingRefresh.current !== null) return;
    const token = ++refreshSequence.current;
    pendingRefresh.current = token;
    setPageRefreshing(true);
    if (activeRole === 'agent' && activeTab === 'dashboard') {
      setDashboardRefreshKey(token);
    } else if (activeTab === 'listingLead') {
      setLeadsReloadToken(token);
    } else if (activeTab === 'listingRoom') {
      setRoomsReloadToken(token);
    } else {
      finishPageRefresh(token);
    }
  }, [activeRole, activeTab, finishPageRefresh]);

  const renderListingCards = () => (
    <>
      <Text style={[styles.listingSectionTitle, headingText]}>Featured Listings ({MOCK_LISTINGS.length})</Text>
      {MOCK_LISTINGS.map((item) => (
        <View key={item.id} style={[styles.listingCard, cardStyle]}>
          <View style={styles.listingTopRow}>
            <MobileBadge role={item.badgeRole} label={item.tag} />
            <Text style={styles.listingPrice}>{item.price} ฿/mo</Text>
          </View>
          <Text style={[styles.listingTitle, headingText]}>{item.title}</Text>
          <Text style={[styles.listingSub, secondaryText]}>{item.roomType} • {item.floor}</Text>
          <View style={styles.listingActionRow}>
            <View style={{ flex: 1 }}>
              <MobileButton variant="outline" onPress={() => Alert.alert('Schedule Viewing', item.title)}>
                <View style={styles.buttonRow}>
                  <MobileIcon name="calendar-plus" size={16} color={tokens.colors.primary} />
                  <Text style={styles.buttonLabel}>{t.common.schedule}</Text>
                </View>
              </MobileButton>
            </View>
            <View style={{ flex: 1 }}>
              <MobileButton onPress={() => Alert.alert('Details', item.title)}>{t.common.viewDetails}</MobileButton>
            </View>
          </View>
        </View>
      ))}
    </>
  );

  const renderBillsBody = () => (
    <View style={styles.bodyContainer}>
      <View style={[styles.card, cardStyle]}>
        <Text style={[styles.sectionHeader, headingText]}>Current Bill</Text>
        <View style={styles.billRow}>
          <Text style={[styles.billLabel, secondaryText]}>Rent (Sep 2026)</Text>
          <Text style={[styles.billValue, headingText]}>14,500 THB</Text>
        </View>
        <View style={styles.billRow}>
          <Text style={[styles.billLabel, secondaryText]}>Utilities</Text>
          <Text style={[styles.billValue, headingText]}>850 THB</Text>
        </View>
        <View style={[styles.billRow, styles.billTotal, { borderTopColor: theme.border }]}>
          <Text style={[styles.billLabel, secondaryText, { fontWeight: '600' }]}>Total Due</Text>
          <Text style={[styles.billValue, { color: tokens.colors.danger, fontWeight: '700' }]}>15,350 THB</Text>
        </View>
        <View style={{ marginTop: 14 }}>
          <MobileButton onPress={() => Alert.alert('Payment', 'Open PromptPay QR')}>
            <View style={styles.buttonRow}>
              <MobileIcon name="qr-code" size={16} color={tokens.colors.primary} />
              <Text style={styles.buttonLabel}>{t.common.payWithQr}</Text>
            </View>
          </MobileButton>
        </View>
      </View>
    </View>
  );

  const renderDashboardBody = () => {
    if (activeRole === 'agent') {
      return (
        <View style={styles.bodyContainer}>
          <MobileAgentDashboardBody
            snapshot={agentDashboardSnapshot}
            onNavigate={handleAgentDashboardNavigate}
            initials={profileInitials}
          />
        </View>
      );
    }
    const summaries: Record<UserRole, { title: string; desc: string; badge: string }> = {
      guest: { title: 'Welcome to NESTYK', desc: 'Browse rooms and schedule viewings nearby.', badge: 'Guest' },
      tenant: { title: 'Tenant Dashboard', desc: 'Lease active · Next bill due in 3 days', badge: 'Active Lease' },
      owner: { title: 'Owner Dashboard', desc: '3 active listings · 2 tenants occupied', badge: '3 Listings' },
      agent: { title: 'Agent Dashboard', desc: '24 co-broke listings · 45,000 THB commission', badge: 'Partner' },
      admin: { title: 'Operations Dashboard', desc: 'Pending tickets: 3 · Inspections today: 2', badge: 'Ops' },
    };
    const summary = summaries[activeRole];
    return (
      <View style={styles.bodyContainer}>
        <View style={[styles.card, cardStyle]}>
          <View style={styles.listingTopRow}>
            <Text style={[styles.sectionHeader, headingText]}>{summary.title}</Text>
            <MobileBadge role={activeRole} label={summary.badge} />
          </View>
          <Text style={[styles.sectionDesc, secondaryText]}>{summary.desc}</Text>
        </View>
      </View>
    );
  };

  const renderTabBody = () => {
    if (activeTab === 'home') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>Discover rooms near you</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>Featured condos and apartments in Bangkok</Text>
          </View>
          {renderListingCards()}
        </View>
      );
    }

    if (activeTab === 'search') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>Search rooms & condos nearby</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>Live GPS · Schedule real viewings instantly</Text>
            <View style={{ marginTop: 12 }}>
              <MobileInput
                placeholder="Project name, BTS/MRT station, or area..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
          {renderListingCards()}
        </View>
      );
    }

    if (activeTab === 'dashboard') {
      return renderDashboardBody();
    }

    if (activeTab === 'living') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <View style={styles.listingTopRow}>
              <Text style={[styles.sectionHeader, headingText]}>My Rental</Text>
              <MobileBadge role="tenant" label="Active Lease" />
            </View>
            <Text style={[styles.listingTitle, headingText]}>The Base Sukhumvit 77 (Room 1804)</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>Lease: Sep 1, 2026 – Aug 31, 2027 (12 months left)</Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'bills') {
      return renderBillsBody();
    }

    if (activeTab === 'income') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>Rental Income</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>Sep 2026 · 3 units · 43,500 THB collected</Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'deals') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>My Deals</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>2 active negotiations · 1 closing this month</Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'listingLead') {
      return (
        <View style={styles.bodyContainer}>
          <AgentLeadsScreen
            initialCreate={leadsOpenCreate}
            workFilter={leadsWorkFilter}
            onCreateConsumed={() => setLeadsOpenCreate(false)}
            reloadToken={leadsReloadToken}
            onReloadSettled={finishPageRefresh}
            searchOpen={leadsSearchOpen}
            onSearchOpenChange={setLeadsSearchOpen}
          />
        </View>
      );
    }

    if (activeTab === 'clients') {
      const dash = t.agent.dashboard;
      const clientsFilterLabel =
        clientsWorkFilter === 'overdue_payment'
          ? dash.clientsFilterOverdue
          : clientsWorkFilter === 'awaiting_signature'
            ? dash.clientsFilterSigning
            : clientsWorkFilter === 'renewal'
              ? dash.clientsFilterRenewal
              : clientsWorkFilter === 'lead_follow_up'
                ? dash.leadsFollowUp
                : null;
      return (
        <View style={styles.bodyContainer}>
          {clientsFilterLabel ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: accentColor,
                backgroundColor: theme.surface,
                minHeight: 44,
              }}
            >
              <Text style={{ flex: 1, color: theme.textHeading, fontSize: 13, lineHeight: 19 }}>
                {dash.filterActive.replace('{label}', clientsFilterLabel)}
              </Text>
              <MobileButton variant="outline" onPress={() => setClientsWorkFilter(null)}>
                {dash.clearFilter}
              </MobileButton>
            </View>
          ) : null}
          {clientsSearchOpen || clientsQuery.trim() ? (
            <MobileInput
              value={clientsQuery}
              onChangeText={setClientsQuery}
              placeholder={t.agent.leads.search}
              autoFocus={clientsSearchOpen && !clientsQuery.trim()}
              onBlur={() => {
                if (!clientsQuery.trim()) setClientsSearchOpen(false);
              }}
            />
          ) : null}
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionDesc, secondaryText]}>{dash.clientsBody}</Text>
            <View style={{ marginTop: 12 }}>
              <MobileButton variant="outline" onPress={() => setActiveTab('contracts')}>
                {dash.openContracts}
              </MobileButton>
            </View>
          </View>
        </View>
      );
    }

    if (activeTab === 'more') {
      const tools: Array<{ label: string; tab: MobileAppTab }> = [
        { label: t.agent.dashboard.openCalendar, tab: 'calendar' },
        { label: t.agent.dashboard.openContacts, tab: 'contact' },
        { label: t.agent.dashboard.openServices, tab: 'services' },
        { label: t.agent.dashboard.openContracts, tab: 'contracts' },
      ];
      return (
        <View style={styles.bodyContainer}>
          <Text style={[styles.sectionDesc, secondaryText]}>{t.agent.dashboard.moreToolsHint}</Text>
          {tools.map((tool) => (
            <View key={tool.tab} style={{ marginTop: 10 }}>
              <MobileButton variant="outline" onPress={() => setActiveTab(tool.tab)}>
                {tool.label}
              </MobileButton>
            </View>
          ))}
          <View style={{ marginTop: 10 }}>
            <MobileButton
              variant="outline"
              onPress={() => Alert.alert(t.agent.dashboard.openCommission, t.agent.dashboard.unavailableSection)}
            >
              {t.agent.dashboard.openCommission}
            </MobileButton>
          </View>
        </View>
      );
    }

    if (activeTab === 'contact') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionDesc, secondaryText]}>
              Owners · buyers · co-broke partners (mock contact book)
            </Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'contracts') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionDesc, secondaryText]}>
              Draft · pending signature · active co-broke contracts (mock)
            </Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'calendar') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionDesc, secondaryText]}>
              Viewings · deal deadlines · follow-ups (mock calendar)
            </Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'tickets') {
      return (
        <View style={styles.bodyContainer}>
          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.sectionHeader, headingText]}>Service Tickets</Text>
            <Text style={[styles.sectionDesc, secondaryText]}>
              {MOCK_SERVICE_TICKETS.length} open tickets · 1 assigned today
            </Text>
          </View>
        </View>
      );
    }

    if (activeTab === 'services') {
      return (
        <View style={styles.bodyContainer}>
          <MobileServiceCatalogBody
            currentRole={activeRole}
            activeTickets={MOCK_SERVICE_TICKETS}
            onRequestService={(cat) => Alert.alert('Service Request', `Requested: ${cat}`)}
            onHubAction={(id) => {
              if (id === 'tickets') Alert.alert('My Tickets', `${MOCK_SERVICE_TICKETS.length} open tickets`);
              if (id === 'emergency') Alert.alert('Emergency', 'Call NESTYK 24h support');
              if (id === 'move') Alert.alert('Move-in / Move-out', 'Schedule inspection and cleaning');
            }}
          />
        </View>
      );
    }

    if (activeTab === 'listingRoom') {
      return (
        <View style={styles.bodyContainer}>
          <AgentRoomsScreen
            onCreate={openCreateListing}
            reloadToken={roomsReloadToken}
            onReloadSettled={finishPageRefresh}
            searchOpen={roomsSearchOpen}
            onSearchOpenChange={setRoomsSearchOpen}
          />
        </View>
      );
    }

    if (activeTab === 'createListing') {
      return (
        <View style={[styles.bodyContainer, styles.wizardBody]}>
          <MobileCreateListingWizardBody
            config={defaultAgentListingConfig}
            pickPhotos={pickRoomPhotos}
            uploadPhoto={uploadRoomPhoto}
            enhancePhoto={enhanceRoomPhoto}
            searchPlaces={handleSearchPlaces}
            getPlaceDetails={handleGetPlaceDetails}
            listContacts={handleListContacts}
            listPropertyTypes={handleListPropertyTypes}
            listContractTypes={handleListContractTypes}
            listRoomTypes={handleListRoomTypes} listFacilities={fetchAgentFacilities} mapsApiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
    searchNearby={(lat, lng) => searchNearbyPlaces(lat, lng, locale)}
            onSubmitListing={async (data) => {
              await createAgentScoutRoom(data);
              Alert.alert(
                t.agent.createRoom.successTitle,
                t.agent.createRoom.successBody,
              );
              setSecondaryReturnTab(null);
              setActiveTab('listingRoom');
            }}
          />
        </View>
      );
    }

    if (activeTab === 'listings') {
      if (activeRole === 'owner') {
        return (
          <View style={[styles.bodyContainer, styles.wizardBody]}>
            <MobileCreateListingWizardBody
              config={defaultOwnerListingConfig}
              searchPlaces={handleSearchPlaces}
              getPlaceDetails={handleGetPlaceDetails}
              onSubmitListing={(data) => Alert.alert('Listing Published', JSON.stringify(data))}
            />
          </View>
        );
      }
    }

    return null;
  };

  const profileName = isAuthenticated ? displayName : t.roles.guest;
  const profileEmail = isAuthenticated ? session!.email : t.common.signIn;
  const profilePhone = isAuthenticated ? session?.phone ?? undefined : undefined;
  const profileInitials = isAuthenticated ? initials : '?';

  const handleAuthAction = async () => {
    setDrawerOpen(false);
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    try {
      await signOut();
      setActiveRole('guest');
      setActiveTab(getDefaultTabForRole('guest'));
      Alert.alert(t.common.signOut, t.mobile.auth.signedOut);
    } catch {
      setActiveRole('guest');
      setActiveTab(getDefaultTabForRole('guest'));
      Alert.alert(t.common.signOut, t.mobile.auth.signedOut);
    }
  };

  const handleRequireAuth = () => {
    setDrawerOpen(false);
    Alert.alert(t.common.signIn, t.mobile.auth.signInToContinue, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.common.signIn, onPress: () => router.push('/login') },
    ]);
  };

  const isWizardTab =
    activeTab === 'createListing' || (activeTab === 'listings' && activeRole === 'owner');

  return (
    <>
      <MobileModePage
        role={activeRole}
        screenTitle={screenTitle}
        scrollable={!isWizardTab}
        refreshing={pageRefreshing}
        onRefresh={
          !isWizardTab && activeRole === 'agent' &&
          ['dashboard', 'listingLead', 'listingRoom'].includes(activeTab)
            ? handlePageRefresh : undefined
        }
        header={
          activeRole === 'agent' ? (
            renderAgentHeader()
          ) : (
            <MobileHeaderActions
              initials={profileInitials}
              isAuthenticated={isAuthenticated}
              notificationCount={unreadCount}
              onAvatarPress={() => setDrawerOpen(true)}
              onNotificationsPress={() => setNotificationsOpen(true)}
            />
          )
        }
        bottomBar={
          <MobileBottomTabBar
            activeRole={activeRole}
            activeTab={activeTab}
            onTabPress={handleTabPress}
            accentColor={accentColor}
            {...(activeRole === 'agent'
              ? {
                  activeTintColor: theme.screenTitle,
                  indicatorColor: tokens.colors.brand[500],
                }
              : {})}
          />
        }
      >
        <React.Fragment key={`${activeRole}-${activeTab}`}>
          {renderTabBody()}
        </React.Fragment>
      </MobileModePage>

      <MobileProfileDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        userName={profileName}
        userEmail={profileEmail}
        userPhone={profilePhone}
        initials={profileInitials}
        activeRole={activeRole}
        isAuthenticated={isAuthenticated}
        onRequireAuth={handleRequireAuth}
        onRoleChange={(role) => {
          handleRoleChange(role);
        }}
        onSignOut={handleAuthAction}
        signOutLabel={isAuthenticated ? t.common.signOut : t.common.signIn}
        onMenuAction={(action) => {
          if (action.type === 'tab') {
            setActiveTab(action.tab);
            return;
          }
          if (action.type === 'route') {
            Alert.alert('Open', action.path);
            return;
          }
          Alert.alert('Action', action.id);
        }}
      />

      <MobileNotificationsPanel
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      >
        <MobileNotificationsBody
          activityItems={notifications}
          messageItems={messages}
          onBack={() => setNotificationsOpen(false)}
          onClearAll={() => {
            setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
            setMessages((prev) => prev.map((n) => ({ ...n, unread: false })));
          }}
        />
      </MobileNotificationsPanel>
    </>
  );
}

const styles = StyleSheet.create({
  bodyContainer: { gap: 16 },
  wizardBody: { flex: 1, minHeight: 0, gap: 0 },
  card: {},
  sectionHeader: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  sectionDesc: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  listingSectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    marginTop: 8,
  },
  listingCard: {
    gap: 6,
  },
  listingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  listingPrice: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: tokens.colors.primary,
  },
  listingTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  listingSub: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  listingActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  billTotal: { borderTopWidth: 1, paddingTop: 8 },
  billLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  billValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonLabel: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    color: tokens.colors.primary,
  },
});
