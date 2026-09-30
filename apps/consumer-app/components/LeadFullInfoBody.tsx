import React, { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { NearbyPlacesMap } from '@nestyk/feature-listing';
import type { AgentLead, LeadPin } from '@nestyk/types';
import { useLocale } from '@nestyk/i18n';
import { MobileBottomSheet, MobileIcon, tokens, useMobileTheme, type AppIconName } from '@nestyk/ui/native';
import { LEAD_NATIONALITY_OPTIONS, LEAD_OCCUPATION_OPTIONS, presetCodeFor } from '../lib/lead-profile-options';
import { formatDate, formatDateTime, formatKm, formatMoveIn } from '../lib/lead-format';
import { distanceKm } from '../lib/lead-match-preview';
import { LeadStatusBadge, SheetHeader, leadCardShadow } from './AgentLeadDetailBody';

type Row = { label: string; value?: string | null; node?: React.ReactNode; trailing?: React.ReactNode; onPress?: () => void };

export function LeadFullInfoBody({ lead }: { lead: AgentLead }) {
  const { t, locale } = useLocale();
  const c = t.agent.leads;
  const info = c.info;
  const { theme } = useMobileTheme();
  const [mapPin, setMapPin] = useState<LeadPin | null>(null);

  const flag = (value: boolean | null, yes: string, no: string) => (value == null ? null : value ? yes : no);
  const money = (value: number | null) => (value == null ? null : `${value.toLocaleString()} ${c.perMonth}`);
  const nationalityCode = presetCodeFor(LEAD_NATIONALITY_OPTIONS, lead.nationality ?? '');
  const occupationCode = presetCodeFor(LEAD_OCCUPATION_OPTIONS, lead.occupation ?? '');
  const phoneDigits = lead.phone.replace(/[^\d+]/g, '');
  const firstPin = lead.pins[0];
  const legacy = [lead.province, ...(lead.locations ?? [])].filter(Boolean).join(' · ');

  const profile: Row[] = [
    { label: info.fullName, value: lead.name },
    {
      label: info.phone,
      value: lead.phone,
      trailing: phoneDigits ? <MobileIcon name="phone" size={18} color={theme.textHeading} /> : undefined,
      onPress: phoneDigits ? () => void Linking.openURL(`tel:${phoneDigits}`) : undefined,
    },
    {
      label: info.nationality,
      value: nationalityCode
        ? c.nationalityOptions[nationalityCode as keyof typeof c.nationalityOptions]
        : lead.nationality || null,
    },
    {
      label: info.occupation,
      value: occupationCode
        ? c.occupationOptions[occupationCode as keyof typeof c.occupationOptions]
        : lead.occupation || null,
    },
    {
      label: info.visa,
      value: lead.visaTypeCode
        ? t.masters.visaTypes[lead.visaTypeCode as keyof typeof t.masters.visaTypes] || lead.visaTypeCode
        : null,
    },
    {
      label: info.occupants,
      value: lead.occupantCount ? c.occupantsOption.replace('{count}', String(lead.occupantCount)) : null,
    },
  ];

  const requirements: Row[] = [
    { label: info.budgetMin, value: money(lead.budgetMin) },
    { label: info.budgetMax, value: money(lead.budgetMax) },
    {
      label: info.roomType,
      value: lead.desiredRoomTypeCode
        ? t.masters.roomTypes[lead.desiredRoomTypeCode as keyof typeof t.masters.roomTypes] || lead.desiredRoomTypeCode
        : null,
    },
    {
      label: info.lease,
      value:
        lead.leaseDurationMonths == null
          ? null
          : t.agent.createRoom.contractMonths.replace('{months}', String(lead.leaseDurationMonths)),
    },
    { label: info.moveIn, value: formatMoveIn(lead.moveInPlan, locale) },
    { label: info.pets, value: flag(lead.hasPets, c.petsYes, c.petsNo) },
    { label: info.car, value: flag(lead.usesCar, c.carYes, c.carNo) },
    { label: info.smoker, value: flag(lead.isSmoker, c.smokeYes, c.smokeNo) },
  ];

  const searchArea: Row[] = lead.pins.length
    ? [
        ...lead.pins.map((pin) => ({
          label: info.pin.replace('{rank}', String(pin.rank)),
          value:
            !firstPin || pin === firstPin
              ? pin.name
              : info.pinDistance
                  .replace('{name}', pin.name)
                  .replace('{km}', formatKm(distanceKm(firstPin.latitude, firstPin.longitude, pin.latitude, pin.longitude))),
          trailing: <MobileIcon name="map-pin" size={16} color={theme.textSecondary} />,
          onPress: () => setMapPin(pin),
        })),
        {
          label: info.radius,
          value: lead.radiusKm == null ? null : c.roomDistance.replace('{km}', String(lead.radiusKm)),
        },
      ]
    : [{ label: info.pin.replace('{rank}', '1'), value: legacy ? c.legacyLocation.replace('{value}', legacy) : null }];
  searchArea.push({ label: info.areaNotes, value: lead.preferredLocation || null });

  const more: Row[] = [
    { label: info.notes, value: lead.notes || null },
    { label: info.createdAt, value: formatDateTime(lead.createdAt, locale) },
    { label: info.status, node: <LeadStatusBadge status={lead.status} /> },
  ];
  if (lead.status === 'lost') more.push({ label: info.lostReason, value: lead.lostReason || null });

  const searchSummary = firstPin
    ? (lead.pins.length > 1 ? c.summaryAreaMore : c.summaryArea)
        .replace('{name}', firstPin.name)
        .replace('{count}', String(lead.pins.length - 1))
        .replace('{km}', String(lead.radiusKm ?? ''))
    : legacy || null;
  const createdDate = formatDate(lead.createdAt, locale);

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section index={1} icon="user" title={c.profileTitle} rows={profile} defaultOpen />
        <Section index={2} icon="home" title={c.requirements} rows={requirements} defaultOpen />
        <Section index={3} icon="map-pin" title={c.sectionSearchArea} rows={searchArea} summary={searchSummary} />
        <Section
          index={4}
          icon="file-text"
          title={c.sectionMore}
          rows={more}
          summary={createdDate ? info.createdSummary.replace('{date}', createdDate) : null}
        />
      </ScrollView>

      <MobileBottomSheet visible={mapPin != null} onClose={() => setMapPin(null)} maxHeight="85%">
        {mapPin ? (
          <>
            <SheetHeader title={c.pinMapTitle.replace('{rank}', String(mapPin.rank))} onClose={() => setMapPin(null)} />
            <View style={styles.mapBody}>
              <Text style={[styles.value, { color: theme.textHeading }]}>{mapPin.name}</Text>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {[
                  mapPin.district,
                  mapPin.province,
                  lead.radiusKm != null ? c.mapWithin.replace('{km}', String(lead.radiusKm)) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <NearbyPlacesMap
                key={mapPin.rank}
                showRecenter={false}
                latitude={mapPin.latitude}
                longitude={mapPin.longitude}
                radiusKm={lead.radiusKm ?? undefined}
                markerTitle={mapPin.name}
                places={[]}
                selectedIds={[]}
                readOnly
                apiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}
              />
            </View>
          </>
        ) : null}
      </MobileBottomSheet>
    </View>
  );
}

function Section({
  index,
  icon,
  title,
  rows,
  defaultOpen = false,
  summary,
}: {
  index: number;
  icon: AppIconName;
  title: string;
  rows: Row[];
  defaultOpen?: boolean;
  /** Shown under the title while collapsed. */
  summary?: string | null;
}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={[styles.section, leadCardShadow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.sectionHead, pressed && Platform.OS === 'ios' ? { opacity: 0.75 } : null]}
        android_ripple={{ color: 'rgba(33,30,30,0.08)' }}
      >
        <View style={[styles.sectionIndex, { backgroundColor: theme.background }]}>
          <Text style={[styles.indexText, { color: theme.textSecondary }]}>{index}</Text>
        </View>
        <MobileIcon name={icon} size={18} color={theme.textHeading} />
        <View style={styles.flex1}>
          <Text style={[styles.sectionTitle, { color: theme.textHeading }]}>{title}</Text>
          {!open && summary ? (
            <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <View style={open ? styles.flip : undefined}>
          <MobileIcon name="chevron-down" size={16} color={theme.textSecondary} />
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={FadeIn.duration(150)} style={[styles.rows, { borderTopColor: theme.border }]}>
          {rows.map((row) => {
            const content = (
              <>
                <Text style={[styles.label, styles.rowLabel, { color: theme.textSecondary }]}>{row.label}</Text>
                <View style={styles.rowValue}>
                  {row.node ?? (
                    <Text
                      selectable={!row.onPress}
                      style={[styles.value, styles.flex1, { color: row.value ? theme.textHeading : tokens.colors.placeholder }]}
                    >
                      {row.value ?? t.agent.leads.unknown}
                    </Text>
                  )}
                  {row.trailing}
                </View>
              </>
            );
            return row.onPress ? (
              <Pressable
                key={row.label}
                onPress={row.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed ? { opacity: 0.7 } : null]}
              >
                {content}
              </Pressable>
            ) : (
              <View key={row.label} style={styles.row}>
                {content}
              </View>
            );
          })}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  flip: { transform: [{ rotate: '180deg' }] },
  scroll: { padding: 16, gap: 12, paddingBottom: 32 },
  section: { borderWidth: 1, borderRadius: 16, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, minHeight: 52 },
  sectionIndex: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  indexText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 12, lineHeight: 18 },
  sectionTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36, paddingVertical: 4 },
  rowLabel: { flex: 2 },
  rowValue: { flex: 3, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20 },
  value: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  mapBody: { paddingHorizontal: 20, paddingBottom: 12, gap: 6 },
});
