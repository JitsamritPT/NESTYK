import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import type { AgentLead } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { listAgentLeads } from '../lib/agent-leads-api';
import { CreateLeadForm } from './CreateLeadForm';

export function AgentLeadsScreen() {
  const { t } = useLocale(); const c = t.agent.leads; const { theme } = useMobileTheme();
  const [creating, setCreating] = useState(false); const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<AgentLead | null>(null);
  const [items, setItems] = useState<AgentLead[]>([]); const [total, setTotal] = useState(0);
  const [query, setQuery] = useState(''); const [page, setPage] = useState(1); const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError(null);
    const timer = setTimeout(() => {
      listAgentLeads(query.trim(), page).then((result) => {
        if (cancelled) return; setItems(result.items); setTotal(result.total);
        if (page > 1 && !result.items.length) setPage(Math.max(1, Math.ceil(result.total / 20)));
      }).catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); }).finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, page, refresh]);
  const budget = (lead: AgentLead) => lead.budgetMin == null && lead.budgetMax == null ? c.unknown : [lead.budgetMin?.toLocaleString(), lead.budgetMax?.toLocaleString()].filter(Boolean).join(' – ') + (t.agent.listings.rentPerMonth.replace('{price}', ''));
  const value = (v: string | number | boolean | null | undefined) => v == null || v === '' ? c.unknown : typeof v === 'boolean' ? (v ? c.yes : c.no) : String(v);
  const roomType = (lead: AgentLead) => lead.desiredRoomTypeCode ? t.masters.roomTypes[lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes] || lead.desiredRoomTypeCode : c.unknown;
  const visa = (lead: AgentLead) => lead.visaTypeCode ? t.masters.visaTypes[lead.visaTypeCode as keyof typeof t.masters.visaTypes] || lead.visaTypeCode : c.unknown;
  const lease = (lead: AgentLead) => lead.leaseDurationMonths == null ? c.unknown : t.agent.createRoom.contractMonths.replace('{months}', String(lead.leaseDurationMonths));
  const rows = (fields: Array<[string, string | number | boolean | null | undefined]>) => fields.map(([label, v]) => <View key={label} style={{ gap: 4 }}><Text style={{ color: theme.textSecondary, lineHeight: 20 }}>{label}</Text><Text selectable style={{ color: theme.textHeading, fontSize: 16, lineHeight: 24 }}>{value(v)}</Text></View>);
  const detail = selected ? {
    profile: [[c.name, selected.name], [c.phone, selected.phone], [c.nationality, selected.nationality], [c.occupation, selected.occupation], [c.visaType, visa(selected)]] as Array<[string, string | number | boolean | null | undefined]>,
    requirements: [[c.budgetMin, selected.budgetMin?.toLocaleString()], [c.budgetMax, selected.budgetMax?.toLocaleString()], [c.preferredLocation, selected.preferredLocation], [c.moveInPlan, selected.moveInPlan], [c.leaseDurationMonths, lease(selected)], [c.occupantCount, selected.occupantCount], [c.hasPets, selected.hasPets], [c.usesCar, selected.usesCar], [c.isSmoker, selected.isSmoker], [c.roomType, roomType(selected)]] as Array<[string, string | number | boolean | null | undefined]>,
  } : null;
  return <View style={{ gap: 14 }}>
    <View style={styles.menu}><View style={{ flex: 1 }}><Text style={[styles.heading, { color: theme.textHeading }]}>{c.listing}</Text><Text style={{ color: theme.textSecondary }}>{c.count.replace('{count}', String(total))}</Text></View><MobileButton onPress={() => setCreating(true)}>＋ {c.create}</MobileButton></View>
    <MobileInput placeholder={c.search} value={query} onChangeText={(q) => { setQuery(q); setPage(1); }} />
    {loading ? <ActivityIndicator color={tokens.colors.roles.agent} /> : error ? <View style={styles.card}><Text style={{ color: theme.textHeading }}>{c.loadError}</Text><Text style={{ color: theme.textSecondary }}>{error}</Text><MobileButton onPress={() => setRefresh((n) => n + 1)}>{c.retry}</MobileButton></View> : !items.length ? <View style={styles.card}><Text style={{ color: theme.textSecondary }}>{query.trim() ? c.noMatches : c.empty}</Text></View> : items.map((lead) => <Pressable key={lead.id} accessibilityRole="button" accessibilityLabel={`${c.details}: ${lead.name}`} onPress={() => setSelected(lead)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.menu}><Text numberOfLines={2} style={[styles.heading, { color: theme.textHeading, flex: 1 }]}>{lead.name}</Text><Text style={styles.badge}>{lead.status === 'new' ? c.newLead : t.agent.listings[lead.status as keyof typeof t.agent.listings] || lead.status}</Text></View>
      <Text style={{ color: theme.textHeading }}>{lead.phone}</Text>
      <Text style={{ color: theme.textSecondary }}>{roomType(lead)} · {lead.preferredLocation || c.unknown}</Text>
      <Text style={[styles.heading, { color: tokens.colors.roles.agent }]}>{budget(lead)}</Text>
      <Text style={{ color: theme.textSecondary }}>{c.moveInPlan}: {lead.moveInPlan || c.unknown}</Text>
      <Text style={{ color: tokens.colors.roles.agent }}>{c.details} ›</Text>
    </Pressable>)}
    {!loading && !error && total > 20 && <View style={styles.menu}><MobileButton variant="outline" disabled={page === 1} onPress={() => setPage((n) => n - 1)}>{c.previous}</MobileButton><Text style={{ color: theme.textHeading }}>{page} / {Math.ceil(total / 20)}</Text><MobileButton variant="outline" disabled={page * 20 >= total} onPress={() => setPage((n) => n + 1)}>{c.next}</MobileButton></View>}
    <Modal visible={creating || selected != null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) { setCreating(false); setSelected(null); } }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.modalHeader, { borderColor: theme.border }]}><MobileButton variant="outline" disabled={busy} onPress={() => { setCreating(false); setSelected(null); }}>{`‹ ${creating ? c.cancel : c.back}`}</MobileButton><Text style={[styles.heading, { color: theme.textHeading }]}>{creating ? c.create : c.details}</Text></View>
        {creating ? <CreateLeadForm onBusy={setBusy} onSaved={() => { setCreating(false); setQuery(''); setPage(1); setRefresh((n) => n + 1); Alert.alert(c.saved); }} /> : detail ? <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}><Text style={[styles.section, { color: theme.textHeading, marginTop: 0 }]}>{c.profile}</Text>{rows(detail.profile)}<Text style={[styles.section, { color: theme.textHeading }]}>{c.requirements}</Text>{rows(detail.requirements)}</ScrollView> : null}
      </SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({ menu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, heading: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 25 }, section: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27, marginTop: 8 }, card: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, gap: 8 }, badge: { color: '#BE185D', backgroundColor: '#FCE7F3', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' }, modalHeader: { padding: 16, gap: 12, borderBottomWidth: 1, flexShrink: 0 } });
