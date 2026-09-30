import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import type { AgentLead } from '@nestyk/types';
import { HeroPhotoPager, RoomShareLinkSheet, type AgentRoomDetail } from '@nestyk/feature-listing';
import {
  MobileActionSheetBody,
  MobileBottomSheet,
  MobileButton,
  MobileIcon,
  MobileScoreRing,
  MobileStatusPill,
  STATUS_PILL_TONES,
  tokens,
  useMobileTheme,
  type AppIconName,
  type MobileStatusPillToneKey,
} from '@nestyk/ui/native';
import {
  createRoomShareLink,
  fetchAgentRoom,
  listRoomShareLinks,
  revokeRoomShareLink,
} from '../lib/agent-listings-api';
import type { LeadRoomMatch } from '../lib/lead-match-preview';
import {
  compareLeadRoom,
  overallScore,
  roomLayoutValue,
  summarizeComparison,
  type CompareKey,
  type CompareStatus,
} from '../lib/lead-room-compare';
import { formatBudgetRange, formatKm, formatMoveIn } from '../lib/lead-format';
import { leadCardShadow } from './AgentLeadDetailBody';
import { useMatchCopy } from './lead-match-copy';

/** Lets the closing sheet's modal unmount before the next one opens (iOS can't stack them mid-animation). */
const SHEET_HANDOFF_MS = 300;

const STATUS_STYLE: Record<CompareStatus, { tone: MobileStatusPillToneKey; icon: AppIconName }> = {
  pass: { tone: 'green', icon: 'check' },
  near: { tone: 'yellow', icon: 'warning' },
  mismatch: { tone: 'yellow', icon: 'warning' },
  later: { tone: 'yellow', icon: 'warning' },
  unspecified: { tone: 'slate', icon: 'info' },
  unknown: { tone: 'slate', icon: 'info' },
  notEvaluable: { tone: 'slate', icon: 'info' },
};

/** Rows the agent should read in full; the rest collapse to one line. */
const EXPANDED: CompareStatus[] = ['near', 'mismatch', 'later', 'unknown', 'notEvaluable'];

const ROW_ICONS: Record<CompareKey, AppIconName> = {
  budget: 'credit-card',
  location: 'map-pin',
  roomType: 'home',
  lease: 'file-text',
  moveIn: 'calendar',
};

export function LeadMatchedRoomBody({
  lead,
  match,
  onOpenRoom,
  menuRequest = 0,
}: {
  lead: AgentLead;
  match: LeadRoomMatch;
  onOpenRoom: (roomId: number) => void;
  /** Bumped by the shell header "⋯" button; a change (not the mount value) opens the menu. */
  menuRequest?: number;
}) {
  const { t, locale, m, roomTypeName, months, issueLabel } = useMatchCopy();
  const c = t.agent.leads;
  const { theme } = useMobileTheme();
  const [room, setRoom] = useState<AgentRoomDetail | null>(null);
  const [roomError, setRoomError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [width, setWidth] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (handoff.current) clearTimeout(handoff.current);
  }, []);

  const seenMenuRequest = useRef(menuRequest);
  useEffect(() => {
    if (menuRequest === seenMenuRequest.current) return;
    seenMenuRequest.current = menuRequest;
    setMenuOpen(true);
  }, [menuRequest]);

  useEffect(() => {
    let active = true;
    setRoomError(false);
    fetchAgentRoom(match.room.id)
      .then((detail) => {
        if (active) setRoom(detail);
      })
      .catch(() => {
        if (active) setRoomError(true);
      });
    return () => {
      active = false;
    };
  }, [match.room.id, attempt]);

  const photos = useMemo(() => {
    const images = room?.medias.filter((media) => media.mediaType === 'image') ?? [];
    if (images.length) return images.map((media) => ({ id: String(media.id), uri: media.mediaUrl }));
    return match.room.coverMediaUrl ? [{ id: 'cover', uri: match.room.coverMediaUrl }] : [];
  }, [room, match.room.coverMediaUrl]);

  const comparison = useMemo(
    () => (room ? compareLeadRoom(lead, match, room) : match.comparison),
    [lead, match, room],
  );
  const score = room ? overallScore(comparison) : match.score;
  const summary = summarizeComparison(comparison);

  const heroHeight = Math.round(Math.min(width * 0.6, 260));
  const title = room?.promoTitle?.trim() || match.room.listingTitle || match.room.property?.name || `#${match.room.id}`;
  const area = match.room.property?.district || match.room.property?.province || '';
  const km = formatKm(match.distanceKm);
  const budget = formatBudgetRange(lead);

  const statusLabel: Record<CompareStatus, string> = {
    pass: m.pass,
    near: m.near,
    mismatch: m.mismatch,
    later: m.later,
    unspecified: m.unspecified,
    unknown: m.roomUnknown,
    notEvaluable: m.notEvaluated,
  };

  const rows: Array<{ key: CompareKey; title: string; want: string | null; have: string | null }> = [
    {
      key: 'budget',
      title: m.budget,
      want: budget ? `${budget} ฿` : null,
      have: `${comparison.budget.price.toLocaleString()} ${c.perMonth}`,
    },
    {
      key: 'location',
      title: m.location,
      want: m.wantLocation.replace('{name}', comparison.location.pinName).replace('{km}', String(lead.radiusKm ?? '')),
      have: m.distanceFromPin.replace('{km}', km).replace('{rank}', String(comparison.location.pinRank)),
    },
    {
      key: 'roomType',
      title: m.roomType,
      want: roomTypeName(comparison.roomType.want),
      have: roomTypeName(comparison.roomType.have),
    },
    {
      key: 'lease',
      title: m.lease,
      want: comparison.lease.want != null ? months(comparison.lease.want) : null,
      have: comparison.lease.terms.length ? months(comparison.lease.terms.join(', ')) : null,
    },
    {
      key: 'moveIn',
      title: m.moveIn,
      want: formatMoveIn(comparison.moveIn.want, locale),
      have: comparison.moveIn.availableFrom
        ? m.availableFrom.replace('{date}', formatMoveIn(comparison.moveIn.availableFrom, locale) ?? '')
        : null,
    },
  ];

  const facts = room ? roomFacts(room, m) : [];

  const onHeroScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
      if (next >= 0 && next < photos.length) setPhotoIndex(next);
    },
    [photos.length, width],
  );

  const afterMenuClose = (next: () => void) => {
    setMenuOpen(false);
    handoff.current = setTimeout(next, SHEET_HANDOFF_MS);
  };

  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.titleRow}>
        <View style={styles.titleMain}>
          <Text style={[styles.title, { color: theme.textHeading }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.price, { color: theme.textHeading }]} numberOfLines={1}>
            {match.price.toLocaleString()} {c.perMonth}
            {match.termMonths ? (
              <Text style={[styles.meta, { color: theme.textSecondary }]}>{`  ·  ${months(match.termMonths)}`}</Text>
            ) : null}
          </Text>
          <View style={styles.inline}>
            <MobileIcon name="map-pin" size={15} color={theme.textSecondary} />
            <Text style={[styles.meta, styles.flex1, { color: theme.textSecondary }]} numberOfLines={1}>
              {[area, m.distanceFromPin.replace('{km}', km).replace('{rank}', String(match.pin.rank))]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        <MobileScoreRing
          value={score}
          size={64}
          label={c.scoreOverallLabel}
          accessibilityLabel={c.matchScoreA11y.replace('{score}', String(score))}
        />
      </View>

      <View style={styles.verdict}>
        {summary.passed ? (
          <VerdictChip tone="green" icon="check" label={m.passCount.replace('{count}', String(summary.passed))} />
        ) : null}
        {summary.issues.map((key) => (
          <VerdictChip key={key} tone="yellow" icon="warning" label={issueLabel(key, comparison)} />
        ))}
        {summary.unknown.length ? (
          <VerdictChip tone="slate" icon="info" label={m.unknownCount.replace('{count}', String(summary.unknown.length))} />
        ) : null}
      </View>

      <View style={[styles.hero, { height: heroHeight || 200, backgroundColor: theme.background }]}>
        {width > 0 && photos.length ? (
          <>
            <FlatList
              data={photos}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onHeroScroll}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              renderItem={({ item }) => (
                <Pressable onPress={() => onOpenRoom(match.room.id)} accessibilityRole="imagebutton">
                  <Image source={{ uri: item.uri }} style={{ width, height: heroHeight }} contentFit="cover" transition={150} />
                </Pressable>
              )}
            />
            <HeroPhotoPager index={photoIndex} total={photos.length} bottom={12} />
          </>
        ) : (
          <View style={styles.heroEmpty}>
            {room || roomError ? (
              <MobileIcon name="camera" size={28} color={tokens.colors.divider} />
            ) : (
              <ActivityIndicator color={tokens.colors.roles.agent} />
            )}
          </View>
        )}
      </View>

      {roomError ? (
        <View style={[styles.errorRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.body, styles.flex1, { color: theme.textHeading }]}>{m.loadError}</Text>
          <MobileButton variant="outline" onPress={() => setAttempt((n) => n + 1)}>
            {c.retry}
          </MobileButton>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textHeading }]}>{m.evaluationTitle}</Text>
        <View style={[styles.card, leadCardShadow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {rows.map((row, index) => {
            const status = comparison[row.key].status as CompareStatus;
            const look = STATUS_STYLE[status];
            const tone = STATUS_PILL_TONES[look.tone];
            const expanded = EXPANDED.includes(status);
            const divider = index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null;
            if (!expanded) {
              const value = status === 'unspecified' ? m.unspecified : row.have;
              return (
                <View key={row.key} style={[styles.compactRow, divider]}>
                  <MobileIcon name={ROW_ICONS[row.key]} size={18} color={theme.textSecondary} />
                  <Text style={[styles.body, styles.bold, styles.compactTitle, { color: theme.textHeading }]}>{row.title}</Text>
                  <Text
                    style={[
                      styles.body,
                      styles.compactValue,
                      { color: status === 'unspecified' ? tokens.colors.placeholder : theme.textHeading },
                    ]}
                    numberOfLines={1}
                  >
                    {value ?? c.unknown}
                  </Text>
                  <MobileIcon name={look.icon} size={16} color={tone.fg} />
                </View>
              );
            }
            return (
              <View key={row.key} style={[styles.compareRow, divider]}>
                <View style={styles.compareHead}>
                  <MobileIcon name={ROW_ICONS[row.key]} size={18} color={theme.textSecondary} />
                  <Text style={[styles.body, styles.bold, styles.flex1, { color: theme.textHeading }]}>{row.title}</Text>
                  <View style={[styles.pill, { backgroundColor: tone.bg }]}>
                    <MobileIcon name={look.icon} size={12} color={tone.fg} />
                    <MobileStatusPill label={statusLabel[status]} tone={look.tone} style={styles.pillInner} />
                  </View>
                </View>
                <View style={styles.compareValues}>
                  <CompareCell label={m.want} value={row.want} />
                  <View style={[styles.valueDivider, { backgroundColor: theme.border }]} />
                  <CompareCell label={m.have} value={row.have} />
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textHeading }]}>{m.factsTitle}</Text>
        <View style={[styles.card, styles.factsCard, leadCardShadow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {!room ? (
            roomError ? (
              <Text style={[styles.body, { color: tokens.colors.placeholder }]}>{c.unknown}</Text>
            ) : (
              <ActivityIndicator color={tokens.colors.roles.agent} />
            )
          ) : facts.length ? (
            pairs(facts).map((pair) => (
              <View key={pair[0].label} style={styles.factRow}>
                {pair.map((fact) => (
                  <View key={fact.label} style={styles.fact}>
                    <Text style={[styles.meta, { color: theme.textSecondary }]}>{fact.label}</Text>
                    <Text style={[styles.body, styles.bold, { color: theme.textHeading }]} numberOfLines={2}>
                      {fact.value}
                    </Text>
                  </View>
                ))}
                {pair.length === 1 ? <View style={styles.fact} /> : null}
              </View>
            ))
          ) : (
            <Text style={[styles.body, { color: tokens.colors.placeholder }]}>{c.unknown}</Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => onOpenRoom(match.room.id)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primaryBtn, pressed && Platform.OS === 'ios' ? { opacity: 0.85 } : null]}
        android_ripple={{ color: 'rgba(255,255,255,0.16)' }}
      >
        <Text style={styles.primaryLabel}>{m.viewRoom}</Text>
        <MobileIcon name="chevron-right" size={18} color="#FFFFFF" />
      </Pressable>

      <MobileBottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <MobileActionSheetBody
          title={c.moreActions}
          actions={[
            { key: 'share', label: m.shareLink, onPress: () => afterMenuClose(() => setShareOpen(true)), disabled: !room },
            { key: 'room', label: m.viewRoom, onPress: () => afterMenuClose(() => onOpenRoom(match.room.id)) },
          ]}
          cancelLabel={t.common.cancel}
          onCancel={() => setMenuOpen(false)}
        />
      </MobileBottomSheet>

      {room ? (
        <RoomShareLinkSheet
          visible={shareOpen}
          room={room}
          api={{ create: createRoomShareLink, list: listRoomShareLinks, revoke: revokeRoomShareLink }}
          onClose={() => setShareOpen(false)}
          onPreview={() => {
            setShareOpen(false);
            handoff.current = setTimeout(() => onOpenRoom(match.room.id), SHEET_HANDOFF_MS);
          }}
        />
      ) : null}
    </View>
  );
}

type MatchRoomCopy = ReturnType<typeof useMatchCopy>['m'];

function roomFacts(room: AgentRoomDetail, m: MatchRoomCopy): Array<{ label: string; value: string }> {
  const size = roomLayoutValue(room, 'room_size');
  const floor = roomLayoutValue(room, 'floor');
  const building = roomLayoutValue(room, 'building');
  const bed = roomLayoutValue(room, 'bedroom');
  const bath = roomLayoutValue(room, 'bathroom');
  const facts: Array<{ label: string; value: string | null }> = [
    { label: m.factSize, value: size ? m.factSizeValue.replace('{value}', size) : null },
    { label: m.factFloor, value: [floor, building].filter(Boolean).join(' · ') || null },
    {
      label: m.factBedBath,
      value: bed || bath ? m.factBedBathValue.replace('{bed}', bed ?? '—').replace('{bath}', bath ?? '—') : null,
    },
    {
      label: m.factDeposit,
      value: m.factDepositValue
        .replace('{deposit}', String(room.depositMonths))
        .replace('{advance}', String(room.advanceRentMonths)),
    },
    { label: m.factWater, value: room.waterRatePerUnit ? m.factRate.replace('{value}', room.waterRatePerUnit) : null },
    { label: m.factElectric, value: room.electricRatePerUnit ? m.factRate.replace('{value}', room.electricRatePerUnit) : null },
  ];
  return facts.filter((fact): fact is { label: string; value: string } => !!fact.value);
}

function pairs<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

function CompareCell({ label, value }: { label: string; value: string | null }) {
  const { t } = useMatchCopy();
  const { theme } = useMobileTheme();
  return (
    <View style={styles.flex1}>
      <Text style={[styles.meta, { color: theme.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.body, { color: value ? theme.textHeading : tokens.colors.placeholder }]}
        numberOfLines={2}
      >
        {value ?? t.agent.leads.unknown}
      </Text>
    </View>
  );
}

function VerdictChip({ tone, icon, label }: { tone: MobileStatusPillToneKey; icon: AppIconName; label: string }) {
  const colors = STATUS_PILL_TONES[tone];
  return (
    <View style={[styles.verdictChip, { backgroundColor: colors.bg }]}>
      <MobileIcon name={icon} size={14} color={colors.fg} />
      <Text style={[styles.verdictText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, paddingBottom: 8 },
  flex1: { flex: 1 },
  bold: { fontFamily: tokens.typography.native.bodyBold },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hero: { borderRadius: 16, overflow: 'hidden' },
  heroEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleMain: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: tokens.typography.native.headingTh, fontSize: 20, lineHeight: 30 },
  price: { fontFamily: tokens.typography.native.headingTh, fontSize: 18, lineHeight: 27 },
  meta: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 14, lineHeight: 21 },
  verdict: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  verdictChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verdictText: { fontFamily: tokens.typography.native.bodyBold, fontSize: 13, lineHeight: 19 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24 },
  card: { borderWidth: 1, borderRadius: 16, overflow: Platform.OS === 'android' ? 'hidden' : 'visible' },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 48 },
  compactTitle: { flexShrink: 0 },
  compactValue: { flex: 1, textAlign: 'right' },
  compareRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  compareHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compareValues: { flexDirection: 'row', gap: 12, paddingLeft: 26 },
  valueDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  pill: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingLeft: 8 },
  pillInner: { paddingLeft: 4, backgroundColor: 'transparent' },
  factsCard: { padding: 14, gap: 12 },
  factRow: { flexDirection: 'row', gap: 12 },
  fact: { flex: 1, minWidth: 0, gap: 2 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: tokens.colors.primary,
    overflow: 'hidden',
  },
  primaryLabel: { fontFamily: tokens.typography.native.headingTh, fontSize: 16, lineHeight: 24, color: '#FFFFFF' },
});
