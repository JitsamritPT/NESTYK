import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert, Pressable, StyleSheet } from 'react-native';
import type { AgentLead, CreateLeadInput } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { fetchAgentContractTypes, fetchAgentRoomTypes } from '../lib/agent-listings-api';
import { createAgentLead, fetchAgentVisaTypes } from '../lib/agent-leads-api';

type TextKey = 'name' | 'phone' | 'nationality' | 'budgetMin' | 'budgetMax' | 'preferredLocation' | 'moveInPlan' | 'occupation' | 'occupantCount';
const empty: Record<TextKey, string> = { name: '', phone: '', nationality: '', budgetMin: '', budgetMax: '', preferredLocation: '', moveInPlan: '', occupation: '', occupantCount: '' };
export function CreateLeadForm({ onSaved, onBusy }: { onSaved: (lead: AgentLead) => void; onBusy: (busy: boolean) => void }) {
  const { t } = useLocale(); const c = t.agent.leads; const { theme } = useMobileTheme();
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<{ hasPets: boolean | null; usesCar: boolean | null; isSmoker: boolean | null }>({ hasPets: null, usesCar: null, isSmoker: null });
  const [roomType, setRoomType] = useState<number | null>(null);
  const [visaType, setVisaType] = useState<number | null>(null);
  const [leaseMonths, setLeaseMonths] = useState<number | null>(null);
  const [types, setTypes] = useState<Array<{ id: number; code: string }>>([]);
  const [visas, setVisas] = useState<Array<{ id: number; code: string }>>([]);
  const [contracts, setContracts] = useState<Array<{ id: number; termMonths: number }>>([]);
  const [typesError, setTypesError] = useState(false); const [typeRetry, setTypeRetry] = useState(0);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false; setTypesError(false);
    Promise.all([fetchAgentRoomTypes(), fetchAgentVisaTypes(), fetchAgentContractTypes()]).then(([rooms, visaRows, contractRows]) => {
      if (cancelled) return;
      setTypes(rooms); setVisas(visaRows);
      const seen = new Set<number>();
      setContracts(contractRows.filter((row) => { if (seen.has(row.termMonths)) return false; seen.add(row.termMonths); return true; }).sort((a, b) => a.termMonths - b.termMonths));
    }).catch(() => { if (!cancelled) setTypesError(true); });
    return () => { cancelled = true; };
  }, [typeRetry]);
  const visaLabel = (code: string) => t.masters.visaTypes[code as keyof typeof t.masters.visaTypes] || code;
  const roomLabel = (code: string) => t.masters.roomTypes[code as keyof typeof t.masters.roomTypes] || code;
  const months = (n: number) => t.agent.createRoom.contractMonths.replace('{months}', String(n));
  const field = (key: TextKey, maxLength: number, numeric = false) => <View onLayout={(e) => { offsets.current[key] = e.nativeEvent.layout.y; }} key={key}><MobileInput
    label={c[key]} value={form[key]} required={key === 'name' || key === 'phone'} editable={!busy} maxLength={maxLength}
    keyboardType={key === 'phone' ? 'phone-pad' : numeric ? 'decimal-pad' : 'default'}
    error={errors[key]} helperText={key === 'moveInPlan' ? c.moveInHint : undefined}
    onChangeText={(value) => { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: '' })); }}
  /></View>;
  const chips = (key: string, selected: number | null, items: Array<{ id: number | null; text: string }>, onSelect: (id: number | null) => void) =>
    <View key={key} onLayout={(e) => { offsets.current[key] = e.nativeEvent.layout.y; }} style={styles.group}>
      <Text style={{ color: theme.textHeading }}>{c[key as 'visaType' | 'leaseDurationMonths' | 'roomType']}</Text>
      <View style={styles.chips}>{items.map((item) => <Pressable key={String(item.id)} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: selected === item.id }} onPress={() => onSelect(item.id)} style={[styles.chip, selected === item.id && styles.selected]}><Text style={{ color: theme.textHeading }}>{item.text}</Text></Pressable>)}</View>
    </View>;
  const toggle = (key: keyof typeof choices) => <View key={key} style={styles.group}><Text style={{ color: theme.textHeading }}>{c[key]}</Text><View style={styles.chips}>{[null, true, false].map((value) => <Pressable key={String(value)} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: choices[key] === value }} onPress={() => setChoices((current) => ({ ...current, [key]: value }))} style={[styles.chip, choices[key] === value && styles.selected]}><Text style={{ color: theme.textHeading }}>{value == null ? c.unknown : value ? c.yes : c.no}</Text></Pressable>)}</View></View>;
  const submit = async () => {
    if (lock.current) return;
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = c.required;
    if (!form.phone.trim()) next.phone = c.required;
    const body: CreateLeadInput = { name: form.name.trim(), phone: form.phone.trim(), ...choices, desiredRoomTypeId: roomType, visaTypeId: visaType, leaseDurationMonths: leaseMonths };
    for (const key of ['nationality', 'preferredLocation', 'moveInPlan', 'occupation'] as const) body[key] = form[key].trim() || null;
    for (const key of ['budgetMin', 'budgetMax', 'occupantCount'] as const) {
      const value = form[key].trim(); const n = Number(value);
      if (!value) { body[key] = null; continue; }
      const integer = key === 'occupantCount';
      if (!Number.isFinite(n) || n < 0 || (key !== 'budgetMin' && n === 0) || (integer && (!Number.isInteger(n) || n > 32767)) || (!integer && (n > 9999999999.99 || Math.abs(n * 100 - Math.round(n * 100)) > 0.001))) next[key] = c.invalidNumber;
      body[key] = n;
    }
    if (body.budgetMin != null && body.budgetMax != null && body.budgetMin > body.budgetMax) next.budgetMax = c.budgetError;
    setErrors(next);
    if (Object.keys(next).length) { scroll.current?.scrollTo({ y: Math.max(0, (offsets.current[Object.keys(next)[0]] ?? 0) - 12), animated: true }); return; }
    lock.current = true; setBusy(true); onBusy(true);
    try { const lead = await createAgentLead(body); onSaved(lead); }
    catch (error) { Alert.alert(c.saveError, error instanceof Error ? error.message : String(error)); }
    finally { lock.current = false; setBusy(false); onBusy(false); }
  };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
      <Text style={{ color: theme.textSecondary }}>{c.optionalHint}</Text>
      <Text style={[styles.heading, { color: theme.textHeading }]}>{c.profile}</Text>
      {field('name', 255)}{field('phone', 50)}{field('nationality', 120)}
      {field('occupation', 255)}
      {chips('visaType', visaType, [{ id: null, text: c.unknown }, ...visas.map((item) => ({ id: item.id, text: visaLabel(item.code) }))], setVisaType)}
      <Text style={[styles.heading, { color: theme.textHeading }]}>{c.requirements}</Text>
      {field('budgetMin', 13, true)}{field('budgetMax', 13, true)}{field('preferredLocation', 500)}{field('moveInPlan', 255)}
      {chips('leaseDurationMonths', leaseMonths, [{ id: null, text: c.unknown }, ...contracts.map((item) => ({ id: item.termMonths, text: months(item.termMonths) }))], setLeaseMonths)}
      {field('occupantCount', 5, true)}
      {toggle('hasPets')}{toggle('usesCar')}{toggle('isSmoker')}
      {chips('roomType', roomType, [{ id: null, text: c.unknown }, ...types.map((item) => ({ id: item.id, text: roomLabel(item.code) }))], setRoomType)}
      {typesError && <View style={styles.group}><Text style={{ color: theme.textSecondary }}>{c.loadError}</Text><MobileButton variant="outline" onPress={() => setTypeRetry((n) => n + 1)}>{c.retry}</MobileButton></View>}
      <MobileButton onPress={submit} isLoading={busy} disabled={busy}>{c.save}</MobileButton>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({ form: { padding: 20, gap: 16, paddingBottom: 40 }, heading: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, marginTop: 8 }, group: { gap: 8 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#CBD5E1', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 }, selected: { borderColor: tokens.colors.roles.agent, backgroundColor: '#FFE4EF' } });
