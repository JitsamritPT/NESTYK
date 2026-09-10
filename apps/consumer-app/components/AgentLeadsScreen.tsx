import { LeadLocationPicker } from './LeadLocationPicker';
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Alert, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import type { AgentLead } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileIcon, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { getAgentLead, listAgentLeads } from '../lib/agent-leads-api';
import { CreateLeadForm } from './CreateLeadForm';
import { AgentLeadDetailBody, LeadStatusBadge } from './AgentLeadDetailBody';

export function AgentLeadsScreen() {
  const { t } = useLocale();
  const c = t.agent.leads;
  const { theme } = useMobileTheme();
  const agentColor = tokens.colors.roles.agent;
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<AgentLead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [items, setItems] = useState<AgentLead[]>([]);
  const [total, setTotal] = useState(0);
  const [province, setProvince] = useState('');
  const [locations, setLocations] = useState<string[]>([]);
  const [includeUnspecified, setIncludeUnspecified] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [draft, setDraft] = useState({ query: '', province: '', locations: [] as string[], includeUnspecified: false });
  const hasFilters = !!(query.trim() || province);
  const toggleSearch = () => {
    if (!searchOpen) setDraft({ query, province, locations, includeUnspecified });
    setSearchOpen((open) => !open);
  };
  const applySearch = () => {
    setQuery(draft.query.trim());
    setProvince(draft.province);
    setLocations(draft.locations);
    setIncludeUnspecified(draft.locations.length > 0 && draft.includeUnspecified);
    setPage(1);
    setSearchOpen(false);
  };
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      listAgentLeads(query.trim(), page, { province, locations, includeUnspecified })
        .then((result) => {
          if (cancelled) return;
          setItems(result.items);
          setTotal(result.total);
          if (page > 1 && !result.items.length) setPage(Math.max(1, Math.ceil(result.total / 20)));
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, page, refresh, province, locations, includeUnspecified]);

  const budget = (lead: AgentLead) =>
    lead.budgetMin == null && lead.budgetMax == null
      ? c.unknown
      : [lead.budgetMin?.toLocaleString(), lead.budgetMax?.toLocaleString()].filter(Boolean).join(' – ')
        + t.agent.listings.rentPerMonth.replace('{price}', '');

  const roomType = (lead: AgentLead) =>
    lead.desiredRoomTypeCode
      ? t.masters.roomTypes[lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes] || lead.desiredRoomTypeCode
      : c.unknown;

  const openLead = async (lead: AgentLead) => {
    setSelected(lead);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const latest = await getAgentLead(lead.id);
      setSelected(latest);
      setItems((current) => current.map((item) => (item.id === latest.id ? latest : item)));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    if (busy) return;
    setCreating(false);
    setSelected(null);
    setDetailError(null);
    setDetailLoading(false);
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.menu}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, { color: theme.textHeading }]}>{c.listing}</Text>
          <Text style={{ color: theme.textSecondary }}>{c.count.replace('{count}', String(total))}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={c.searchFilters} accessibilityState={{ expanded: searchOpen }} onPress={toggleSearch}
          style={({ pressed }) => [styles.searchButton, { borderColor: searchOpen || hasFilters ? agentColor : theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 }]}>
          <MobileIcon name={searchOpen ? 'close' : 'search'} size={22} color={searchOpen || hasFilters ? agentColor : theme.textHeading} />
          {hasFilters && !searchOpen && <View style={[styles.activeDot, { backgroundColor: agentColor }]} />}
        </Pressable>
        <MobileButton onPress={() => setCreating(true)}>＋ {c.create}</MobileButton>
      </View>

      {hasFilters && !searchOpen && <Pressable accessibilityRole="button" onPress={toggleSearch} style={styles.activeSummary}>
        <MobileIcon name="search" size={14} color={agentColor} />
        <Text numberOfLines={2} style={[styles.label, { color: theme.textSecondary, flex: 1 }]}>
          {[query.trim(), province, ...locations, locations.length && includeUnspecified ? c.includeUnspecified : ''].filter(Boolean).join(' · ')}
        </Text>
      </Pressable>}

      {searchOpen && <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, gap: 14 }]}>
        <Text style={[styles.heading, { color: theme.textHeading }]}>{c.searchFilters}</Text>
        <MobileInput placeholder={c.search} value={draft.query} onChangeText={(value) => setDraft((current) => ({ ...current, query: value }))} returnKeyType="search" onSubmitEditing={applySearch} />
        <LeadLocationPicker filter province={draft.province} locations={draft.locations} onChange={(p, areas) => setDraft((current) => ({ ...current, province: p, locations: areas, includeUnspecified: areas.length > 0 && current.includeUnspecified }))} />
        {draft.locations.length > 0 && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.includeUnspecified }} onPress={() => setDraft((current) => ({ ...current, includeUnspecified: !current.includeUnspecified }))} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: agentColor }}>{draft.includeUnspecified ? '☑' : '☐'}</Text><Text style={[styles.bodyText, { color: theme.textHeading, flex: 1 }]}>{c.includeUnspecified}</Text>
        </Pressable>}
        <MobileButton onPress={applySearch}>{c.applyFilters}</MobileButton>
        {!!(draft.query || draft.province || hasFilters) && <MobileButton variant="outline" onPress={() => {
          setDraft({ query: '', province: '', locations: [], includeUnspecified: false });
          setQuery(''); setProvince(''); setLocations([]); setIncludeUnspecified(false); setPage(1);
        }}>{c.clearFilters}</MobileButton>}
      </View>}

      {loading ? (
        <ActivityIndicator color={agentColor} />
      ) : error ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.textHeading }}>{c.loadError}</Text>
          <Text style={{ color: theme.textSecondary }}>{error}</Text>
          <MobileButton onPress={() => setRefresh((n) => n + 1)}>{c.retry}</MobileButton>
        </View>
      ) : !items.length ? (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary }}>{(query.trim() || province) ? c.noMatches : c.empty}</Text>
        </View>
      ) : (
        items.map((lead) => (
          <Pressable
            key={lead.id}
            accessibilityRole="button"
            accessibilityLabel={`${c.details}: ${lead.name}`}
            onPress={() => void openLead(lead)}
            android_ripple={{ color: `${agentColor}22` }}
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && Platform.OS === 'ios' ? { opacity: 0.88 } : null,
            ]}
          >
            <View style={styles.menu}>
              <Text numberOfLines={2} style={[styles.heading, { color: theme.textHeading, flex: 1 }]}>
                {lead.name}
              </Text>
              <LeadStatusBadge status={lead.status} />
            </View>
            <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{lead.phone}</Text>
            <View style={[styles.budgetPanel, { backgroundColor: theme.background }]}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{c.budget}</Text>
              <Text style={[styles.budgetValue, { color: agentColor }]}>{budget(lead)}</Text>
            </View>
            <View style={styles.facts}>
              {[
                [c.roomType, roomType(lead)],
                [c.province, lead.province || c.unknown],
                [c.preferredLocation, lead.locationName ? `${lead.locationName} · ${c.mapWithin.replace('{km}', String(lead.radiusKm))}` : lead.locations?.length ? lead.locations.join(' · ') : lead.preferredLocation || c.unspecifiedArea],
                [c.moveInPlan, lead.moveInPlan || c.unknown],
              ].map(([label, value]) => (
                <View key={label} style={styles.factRow}>
                  <Text style={[styles.factLabel, styles.label, { color: theme.textSecondary }]}>{label}</Text>
                  <Text style={[styles.factValue, styles.bodyText, { color: theme.textHeading }]}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.cardFooter, { borderColor: theme.border }]}>
              <Text style={[styles.detailLink, { color: agentColor }]}>{c.details}</Text>
              <MobileIcon name="chevron-right" size={18} color={agentColor} />
            </View>
          </Pressable>
        ))
      )}

      {!loading && !error && total > 20 && (
        <View style={styles.menu}>
          <MobileButton variant="outline" disabled={page === 1} onPress={() => setPage((n) => n - 1)}>
            {c.previous}
          </MobileButton>
          <Text style={{ color: theme.textHeading }}>
            {page} / {Math.ceil(total / 20)}
          </Text>
          <MobileButton variant="outline" disabled={page * 20 >= total} onPress={() => setPage((n) => n + 1)}>
            {c.next}
          </MobileButton>
        </View>
      )}

      <Modal
        visible={creating || selected != null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeModal}
      >
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <View style={[styles.modalHeader, { borderColor: theme.border }]}>
              <MobileButton variant="outline" disabled={busy} onPress={closeModal}>
                {`‹ ${creating ? c.cancel : c.back}`}
              </MobileButton>
              <Text style={[styles.heading, { color: theme.textHeading }]}>
                {creating ? c.create : c.details}
              </Text>
            </View>
            {creating ? (
              <CreateLeadForm
                onBusy={setBusy}
                onSaved={() => {
                  setCreating(false);
                  setQuery('');
                  setPage(1);
                  setRefresh((n) => n + 1);
                  Alert.alert(c.saved);
                }}
              />
            ) : selected ? (
              <>
                {detailError ? (
                  <View style={[styles.detailBanner, { borderColor: theme.border, backgroundColor: theme.surface }]}>
                    <Text style={{ color: theme.textHeading }}>{c.loadError}</Text>
                    <Text style={{ color: theme.textSecondary }}>{detailError}</Text>
                    <MobileButton onPress={() => void openLead(selected)}>{c.retry}</MobileButton>
                  </View>
                ) : null}
                {detailLoading ? <ActivityIndicator style={{ marginTop: 8 }} color={agentColor} /> : null}
                <AgentLeadDetailBody lead={selected} />
              </>
            ) : null}
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchButton: { width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeDot: { position: 'absolute', top: 7, right: 7, width: 6, height: 6, borderRadius: 3 },
  activeSummary: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  menu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 25 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18, gap: 8 },
  bodyText: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 20 },
  budgetPanel: { borderRadius: 12, padding: 14, gap: 4, marginVertical: 6 },
  budgetValue: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  facts: { gap: 10, paddingBottom: 6 },
  factRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  factLabel: { flex: 2 },
  factValue: { flex: 3, textAlign: 'right' },
  cardFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailLink: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  modalHeader: { padding: 16, gap: 12, borderBottomWidth: 1, flexShrink: 0 },
  detailBanner: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
});
