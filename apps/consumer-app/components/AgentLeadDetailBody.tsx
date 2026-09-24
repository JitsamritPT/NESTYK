import React from 'react';
import { NearbyPlacesMap } from '@nestyk/feature-listing';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { AgentLead } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { tokens, useMobileTheme, MobileStatusPill, MobileButton, type MobileStatusPillToneKey } from '@nestyk/ui/native';
import { LEAD_NATIONALITY_OPTIONS, LEAD_OCCUPATION_OPTIONS, presetCodeFor } from '../lib/lead-profile-options';

const LEAD_STATUS_TONE: Record<string, MobileStatusPillToneKey> = {
  new: 'yellow',
  inprogress: 'blue',
  booked: 'green',
  lost: 'red',
};

export function leadStatusTone(status: string): MobileStatusPillToneKey {
  return LEAD_STATUS_TONE[status] ?? 'slate';
}

export function leadAvatarInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export function LeadStatusBadge({ status }: { status: string }) {
  const { t } = useLocale();
  const c = t.agent.leads;
  const key = status as keyof typeof c.statuses;
  const label = c.statuses[key] || status;
  return <MobileStatusPill label={label} tone={leadStatusTone(status)} />;
}

export function AgentLeadDetailBody({
  lead,
  statusBusy = false,
  onMarkInProgress,
  onMarkLost,
}: {
  lead: AgentLead;
  statusBusy?: boolean;
  onMarkInProgress?: () => void;
  onMarkLost?: () => void;
}) {
  const { t } = useLocale();
  const c = t.agent.leads;
  const { theme } = useMobileTheme();
  const agentColor = tokens.colors.roles.agent;
  const canMarkInProgress = lead.status === 'new' || lead.status === 'lost';
  const canMarkLost = lead.status === 'new' || lead.status === 'inprogress';

  const display = (v: string | number | boolean | null | undefined) =>
    v == null || v === '' ? c.unknown : typeof v === 'boolean' ? (v ? c.yes : c.no) : String(v);

  const roomType = lead.desiredRoomTypeCode
    ? t.masters.roomTypes[lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes] || lead.desiredRoomTypeCode
    : c.unknown;
  const visa = lead.visaTypeCode
    ? t.masters.visaTypes[lead.visaTypeCode as keyof typeof t.masters.visaTypes] || lead.visaTypeCode
    : c.unknown;
  const lease = lead.leaseDurationMonths == null
    ? c.unknown
    : t.agent.createRoom.contractMonths.replace('{months}', String(lead.leaseDurationMonths));
  const budget =
    lead.budgetMin == null && lead.budgetMax == null
      ? c.unknown
      : [lead.budgetMin?.toLocaleString(), lead.budgetMax?.toLocaleString()].filter(Boolean).join(' – ')
        + t.agent.listings.rentPerMonth.replace('{price}', '');

  const nationalityCode = presetCodeFor(LEAD_NATIONALITY_OPTIONS, lead.nationality ?? '');
  const occupationCode = presetCodeFor(LEAD_OCCUPATION_OPTIONS, lead.occupation ?? '');
  const profileRows: Array<[string, string]> = [
    [c.nationality, nationalityCode ? c.nationalityOptions[nationalityCode as keyof typeof c.nationalityOptions] : display(lead.nationality)],
    [c.occupation, occupationCode ? c.occupationOptions[occupationCode as keyof typeof c.occupationOptions] : display(lead.occupation)],
    [c.visaType, visa],
  ];
  const requirementRows: Array<[string, string]> = [
    [c.province, display(lead.province)],
    [c.preferredLocation, lead.locationName ? `${lead.locationName} · ${c.mapWithin.replace('{km}', String(lead.radiusKm))}` : lead.locations?.length ? lead.locations.join(' · ') : c.unspecifiedArea],
    [c.locationNotes, display(lead.preferredLocation)],
    [c.moveInPlan, display(lead.moveInPlan)],
    [c.leaseDurationMonths, lease],
    [c.occupantCount, display(lead.occupantCount)],
    [c.roomType, roomType],
  ];
  const flags: Array<[string, boolean | null]> = [
    [c.hasPets, lead.hasPets],
    [c.usesCar, lead.usesCar],
    [c.isSmoker, lead.isSmoker],
  ];

  const call = () => {
    const digits = lead.phone.replace(/[^\d+]/g, '');
    if (!digits) return;
    void Linking.openURL(`tel:${digits}`);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.heroName, { color: theme.textHeading }]}>{lead.name}</Text>
            <LeadStatusBadge status={lead.status} />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${c.callPhone} ${lead.phone}`}
          onPress={call}
          android_ripple={{ color: `${agentColor}22` }}
          style={({ pressed }) => [
            styles.phoneRow,
            { borderColor: `${agentColor}44`, backgroundColor: `${agentColor}0F` },
            pressed && Platform.OS === 'ios' ? { opacity: 0.75 } : null,
          ]}
        >
          <Text style={[styles.phoneText, { color: agentColor }]}>{lead.phone}</Text>
          <Text style={[styles.callHint, { color: agentColor }]}>{c.callPhone}</Text>
        </Pressable>

        <View style={[styles.budgetBlock, { borderColor: theme.border }]}>
          <Text style={[styles.budgetLabel, { color: theme.textSecondary }]}>{c.budget}</Text>
          <Text style={[styles.budgetValue, { color: agentColor }]}>{budget}</Text>
        </View>

        {lead.status === 'lost' && lead.lostReason ? (
          <View style={[styles.lostReasonBox, { borderColor: theme.border, backgroundColor: theme.background }]}>
            <Text style={[styles.budgetLabel, { color: theme.textSecondary }]}>{c.lostReason}</Text>
            <Text style={[styles.lostReasonText, { color: theme.textHeading }]}>{lead.lostReason}</Text>
          </View>
        ) : null}

        {(canMarkInProgress || canMarkLost) && (onMarkInProgress || onMarkLost) ? (
          <View style={styles.statusActions}>
            {canMarkInProgress && onMarkInProgress ? (
              <MobileButton onPress={onMarkInProgress} disabled={statusBusy} isLoading={statusBusy}>
                {c.markInProgress}
              </MobileButton>
            ) : null}
            {canMarkLost && onMarkLost ? (
              <MobileButton variant="outline" onPress={onMarkLost} disabled={statusBusy}>
                {c.markLost}
              </MobileButton>
            ) : null}
          </View>
        ) : null}
      </View>

      {lead.latitude != null && lead.longitude != null && lead.radiusKm != null && <Section title={c.mapLocation} theme={theme}>
        <View style={{ paddingVertical: 12, gap: 8 }}>
          <Text style={{ color: theme.textHeading }}>{lead.locationName} · {c.mapWithin.replace('{km}', String(lead.radiusKm))}</Text>
          <NearbyPlacesMap showRecenter={false} latitude={lead.latitude} longitude={lead.longitude} radiusKm={lead.radiusKm} markerTitle={lead.locationName ?? undefined} places={[]} selectedIds={[]} readOnly apiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY} />
        </View>
      </Section>}

      <Section title={c.profile} theme={theme}>
        {profileRows.map(([label, value], index) => (
          <DetailRow key={label} label={label} value={value} theme={theme} divider={index < profileRows.length - 1} />
        ))}
      </Section>

      <Section title={c.requirements} theme={theme}>
        {requirementRows.map(([label, value]) => (
          <DetailRow key={label} label={label} value={value} theme={theme} divider />
        ))}
        {flags.map(([label, value]) => (
          <DetailRow key={label} label={label} value={display(value)} theme={theme} divider />
        ))}
        <DetailRow label={c.notes} value={display(lead.notes)} theme={theme} divider={false} />
      </Section>
    </ScrollView>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: { surface: string; border: string; textHeading: string };
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.textHeading }]}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({
  label,
  value,
  theme,
  divider,
}: {
  label: string;
  value: string;
  theme: { textSecondary: string; textHeading: string; border: string };
  divider: boolean;
}) {
  return (
    <View style={[styles.row, divider ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border } : null]}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text selectable style={[styles.rowValue, { color: theme.textHeading }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroName: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 30,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  phoneText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  callHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
  },
  budgetBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    gap: 4,
  },
  budgetLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  budgetValue: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 33,
  },
  lostReasonBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  lostReasonText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
  },
  statusActions: {
    gap: 10,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  row: {
    paddingVertical: 12,
    gap: 4,
  },
  rowLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
  },
  rowValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
});
