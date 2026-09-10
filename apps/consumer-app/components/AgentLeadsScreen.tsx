import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Alert, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView, initialWindowMetrics } from 'react-native-safe-area-context';
import type { AgentLead } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
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
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      listAgentLeads(query.trim(), page)
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
  }, [query, page, refresh]);

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
        <MobileButton onPress={() => setCreating(true)}>＋ {c.create}</MobileButton>
      </View>

      <MobileInput
        placeholder={c.search}
        value={query}
        onChangeText={(q) => {
          setQuery(q);
          setPage(1);
        }}
      />

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
          <Text style={{ color: theme.textSecondary }}>{query.trim() ? c.noMatches : c.empty}</Text>
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
            <Text style={{ color: theme.textHeading }}>{lead.phone}</Text>
            <Text style={{ color: theme.textSecondary }}>
              {roomType(lead)} · {lead.preferredLocation || c.unknown}
            </Text>
            <Text style={[styles.heading, { color: agentColor }]}>{budget(lead)}</Text>
            <Text style={{ color: theme.textSecondary }}>
              {c.moveInPlan}: {lead.moveInPlan || c.unknown}
            </Text>
            <Text style={{ color: agentColor }}>{c.details} ›</Text>
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
  menu: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 25 },
  card: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16, gap: 8 },
  modalHeader: { padding: 16, gap: 12, borderBottomWidth: 1, flexShrink: 0 },
  detailBanner: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
});
