import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileBrandLoader, MobileButton, MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';

export type AgentListingsViewMode = 'grid' | 'row';

export type AgentListingCard = {
  id: number;
  listingTitle: string | null;
  visibility: 'private' | 'published' | null;
  listingSourceCode?: 'co_agent' | 'owner' | null;
  roomStatusCode: string | null;
  property: {
    id: number;
    name: string;
    district: string;
    province: string;
  } | null;
  propertyOwner: {
    id: number;
    name: string;
    phone: string;
  } | null;
  contact?: {
    id: number;
    name: string;
    phone: string;
  } | null;
  prices: Array<{ contractTypeId?: number; contractTypeCode: string; price: number }>;
  coverMediaUrl: string | null;
  bedroomCount?: string | null;
  roomSizeSqm?: string | null;
  updatedAt?: string | null;
};

export interface MobileAgentListingsBodyProps {
  items: AgentListingCard[];
  viewMode?: AgentListingsViewMode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRoomPress?: (id: number) => void;
  filtered?: boolean;
  onCreatePress?: () => void;
}

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(`{${key}}`, String(value)),
    template,
  );
}

function minPrice(items: AgentListingCard['prices']): number | null {
  if (!items.length) return null;
  return Math.min(...items.map((item) => item.price));
}

function Cover({ uri, fallback, style }: { uri: string | null; fallback: string; style?: object }) {
  const [failed, setFailed] = React.useState(false);
  const source = React.useMemo(() => (uri ? { uri } : undefined), [uri]);
  React.useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) {
    return (
      <View style={[styles.cover, styles.coverFallback, style]}>
        <Text style={styles.coverFallbackText}>{fallback}</Text>
      </View>
    );
  }
  return (
    <Image
      source={source}
      resizeMode="cover"
      style={[styles.cover, style]}
      onError={() => setFailed(true)}
    />
  );
}

/** Hybrid 06 Airy outline — white pill + semantic stroke (readable on photo). */
function statusTone(code: string | null): {
  dot: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
} {
  if (code === 'available') {
    return {
      dot: tokens.colors.success,
      badgeBg: tokens.colors.white,
      badgeBorder: tokens.colors.subtle.successFg,
      badgeText: tokens.colors.subtle.successFg,
    };
  }
  if (code === 'rented') {
    return {
      dot: tokens.colors.icon.secondary,
      badgeBg: tokens.colors.white,
      badgeBorder: tokens.colors.icon.secondary,
      badgeText: tokens.colors.icon.secondary,
    };
  }
  if (code === 'needs_edit') {
    return {
      dot: tokens.colors.danger,
      badgeBg: tokens.colors.white,
      badgeBorder: tokens.colors.subtle.dangerFg,
      badgeText: tokens.colors.subtle.dangerFg,
    };
  }
  // pending_verification and other pending states
  return {
    dot: tokens.colors.warning,
    badgeBg: tokens.colors.white,
    badgeBorder: tokens.colors.subtle.warningFg,
    badgeText: tokens.colors.subtle.warningFg,
  };
}

function useListingLabels(item: AgentListingCard) {
  const { t } = useLocale();
  const copy = t.agent.listings;
  const cr = t.agent.createRoom;

  const title = item.listingTitle || item.property?.name || `#${item.id}`;
  const location = item.property?.district || item.property?.province || '';
  const price = minPrice(item.prices);
  const priceLabel =
    price != null ? interpolate(copy.rentPerMonthShort, { price: price.toLocaleString() }) : null;
  const statusLabel =
    copy[item.roomStatusCode as keyof typeof copy] || item.roomStatusCode || copy.notSpecified;
  const sourceLabel =
    item.listingSourceCode === 'owner'
      ? cr.sourceOwner
      : item.listingSourceCode === 'co_agent'
        ? cr.sourceCoAgent
        : copy.notSpecified;

  const beds = item.bedroomCount?.trim();
  let bedsLabel: string | null = null;
  if (beds) {
    const n = Number(beds);
    bedsLabel =
      Number.isFinite(n) && n !== 1
        ? interpolate(copy.specBeds, { count: beds })
        : interpolate(copy.specBed, { count: beds });
  }
  const sqm = item.roomSizeSqm?.trim();
  const sqmLabel = sqm ? interpolate(copy.specSqm, { size: sqm }) : null;

  return { title, location, priceLabel, statusLabel, sourceLabel, bedsLabel, sqmLabel };
}

function MetaRow({
  icon,
  label,
  color,
}: {
  icon: 'map-pin' | 'bed' | 'room-size';
  label: string;
  color: string;
}) {
  return (
    <View style={styles.metaRow}>
      <MobileIcon name={icon} size={13} color={color} />
      <Text style={[styles.metaText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Beds + sqm on one line: 🛏 2 beds · ▢ 52 sqm */
function SpecsMetaRow({
  bedsLabel,
  sqmLabel,
  color,
}: {
  bedsLabel: string | null;
  sqmLabel: string | null;
  color: string;
}) {
  if (!bedsLabel && !sqmLabel) return null;
  return (
    <View style={styles.metaRow}>
      {bedsLabel ? (
        <>
          <MobileIcon name="bed" size={13} color={color} />
          <Text style={[styles.metaText, { color }]} numberOfLines={1}>
            {bedsLabel}
          </Text>
        </>
      ) : null}
      {bedsLabel && sqmLabel ? (
        <Text style={[styles.metaDot, { color }]}>·</Text>
      ) : null}
      {sqmLabel ? (
        <>
          <MobileIcon name="room-size" size={13} color={color} />
          <Text style={[styles.metaText, { color }]} numberOfLines={1}>
            {sqmLabel}
          </Text>
        </>
      ) : null}
    </View>
  );
}

function StatusBadge({
  label,
  code,
  compact = false,
}: {
  label: string;
  code: string | null;
  compact?: boolean;
}) {
  const tone = statusTone(code);
  return (
    <View
      style={[
        styles.statusBadge,
        compact && styles.statusBadgeCompact,
        {
          backgroundColor: tone.badgeBg,
          borderColor: tone.badgeBorder,
        },
      ]}
    >
      <View style={[styles.statusDot, compact && styles.statusDotCompact, { backgroundColor: tone.dot }]} />
      <Text
        style={[styles.statusBadgeText, compact && styles.statusBadgeTextCompact, { color: tone.badgeText }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** Hybrid 06 + 01 — white pill, amber outline, ink label (brand cue). */
function SourceChip({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <View style={[styles.sourceChip, compact && styles.sourceChipCompact]}>
      <MobileIcon name="user" size={compact ? 11 : 12} color={tokens.colors.primary} />
      <Text style={[styles.sourceChipText, compact && styles.sourceChipTextCompact]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function GridCard({
  item,
  cardWidth,
  onPress,
}: {
  item: AgentListingCard;
  cardWidth: number;
  onPress: () => void;
}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const copy = t.agent.listings;
  const labels = useListingLabels(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.viewRoom}: ${labels.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridCard,
        { width: cardWidth, backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.92 : 1 },
      ]}
      {...(Platform.OS === 'android' ? { android_ripple: { color: 'rgba(0,0,0,0.06)' } } : {})}
    >
      <View style={styles.gridImageWrap}>
        <Cover
          uri={item.coverMediaUrl}
          fallback={item.property?.name?.slice(0, 1) ?? 'R'}
          style={styles.gridCover}
        />
        <View style={styles.gridBadgeSlot}>
          <StatusBadge label={String(labels.statusLabel)} code={item.roomStatusCode} />
        </View>
        <View style={styles.gridSourceSlot}>
          <SourceChip label={labels.sourceLabel} />
        </View>
      </View>
      <View style={styles.gridBody}>
        <Text style={[styles.gridTitle, { color: theme.textHeading }]} numberOfLines={1}>
          {labels.title}
        </Text>
        {labels.location ? (
          <MetaRow icon="map-pin" label={labels.location} color={theme.textSecondary} />
        ) : null}
        <SpecsMetaRow
          bedsLabel={labels.bedsLabel}
          sqmLabel={labels.sqmLabel}
          color={theme.textSecondary}
        />
        {labels.priceLabel ? (
          <Text style={[styles.gridPrice, { color: theme.textHeading }]} numberOfLines={1}>
            {labels.priceLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function RowItem({
  item,
  onPress,
}: {
  item: AgentListingCard;
  onPress: () => void;
}) {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const copy = t.agent.listings;
  const labels = useListingLabels(item);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.viewRoom}: ${labels.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.rowCard,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      {...(Platform.OS === 'android' ? { android_ripple: { color: 'rgba(0,0,0,0.06)' } } : {})}
    >
      <View style={styles.rowThumbWrap}>
        <Cover
          uri={item.coverMediaUrl}
          fallback={item.property?.name?.slice(0, 1) ?? 'R'}
          style={styles.rowThumb}
        />
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, { color: theme.textHeading }]} numberOfLines={1}>
          {labels.title}
        </Text>
        {labels.location ? (
          <MetaRow icon="map-pin" label={labels.location} color={theme.textSecondary} />
        ) : null}
        <SpecsMetaRow
          bedsLabel={labels.bedsLabel}
          sqmLabel={labels.sqmLabel}
          color={theme.textSecondary}
        />
        <View style={styles.rowStatus}>
          <StatusBadge
            label={String(labels.statusLabel)}
            code={item.roomStatusCode}
            compact
          />
        </View>
      </View>
      <View style={styles.rowAside}>
        {labels.priceLabel ? (
          <Text style={[styles.rowPrice, { color: theme.textHeading }]} numberOfLines={1}>
            {labels.priceLabel}
          </Text>
        ) : null}
        <SourceChip label={labels.sourceLabel} compact />
      </View>
    </Pressable>
  );
}

export const MobileAgentListingsBody: React.FC<MobileAgentListingsBodyProps> = ({
  items,
  viewMode = 'row',
  loading = false,
  error = null,
  onRetry,
  onRoomPress,
  filtered,
  onCreatePress,
}) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const copy = t.agent.listings;
  const muted = theme.textSecondary;
  const { width } = useWindowDimensions();
  const gridGap = 12;
  const gridCardWidth = Math.floor((width - 32 - gridGap) / 2);

  if (loading) {
    return (
      <MobileBrandLoader size="md" fill done={false} />
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: theme.textHeading }]}>{copy.loadError}</Text>
        <Text style={[styles.emptyBody, { color: muted }]}>{error}</Text>
        {onRetry ? (
          <View style={styles.ctaWrap}>
            <MobileButton onPress={onRetry}>{copy.retry}</MobileButton>
          </View>
        ) : null}
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: theme.textHeading }]}>
          {filtered ? copy.noMatches : copy.emptyTitle}
        </Text>
        <Text style={[styles.emptyBody, { color: muted }]}>
          {filtered ? copy.noMatchesHint : copy.emptyBody}
        </Text>
        {onCreatePress && !filtered ? (
          <View style={styles.ctaWrap}>
            <MobileButton onPress={onCreatePress}>{copy.emptyCta}</MobileButton>
          </View>
        ) : null}
      </View>
    );
  }

  if (viewMode === 'grid') {
    return (
      <View style={[styles.gridList, { gap: gridGap }]}>
        {items.map((item) => (
          <GridCard
            key={item.id}
            item={item}
            cardWidth={gridCardWidth}
            onPress={() => onRoomPress?.(item.id)}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.rowList}>
      {items.map((item) => (
        <RowItem
          key={item.id}
          item={item}
          onPress={() => onRoomPress?.(item.id)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  ctaWrap: {
    alignSelf: 'stretch',
    marginTop: 8,
  },
  cover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverFallbackText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 28,
    lineHeight: 40,
    color: tokens.colors.roles.agent,
  },
  gridList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 24,
  },
  gridCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridImageWrap: {
    aspectRatio: 4 / 3,
    width: '100%',
  },
  gridCover: {
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
  },
  gridBadgeSlot: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  gridSourceSlot: {
    position: 'absolute',
    right: 8,
    bottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  statusBadgeTextCompact: {
    fontSize: 10,
    lineHeight: 15,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.brand[500],
    maxWidth: 120,
  },
  sourceChipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
    maxWidth: 110,
  },
  sourceChipText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    color: tokens.colors.primary,
    flexShrink: 1,
  },
  sourceChipTextCompact: {
    fontSize: 10,
    lineHeight: 15,
  },
  gridBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 3,
  },
  gridTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    flexWrap: 'nowrap',
  },
  metaText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    flexShrink: 1,
  },
  metaDot: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 1,
  },
  gridPrice: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    marginTop: 4,
  },
  rowList: {
    gap: 12,
    paddingBottom: 24,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowThumbWrap: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  rowThumb: {
    borderRadius: 12,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingTop: 1,
  },
  rowTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  rowStatus: {
    marginTop: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusDotCompact: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowAside: {
    alignItems: 'flex-end',
    gap: 6,
    flexShrink: 0,
    maxWidth: 128,
    paddingTop: 2,
  },
  rowPrice: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'right',
  },
});
