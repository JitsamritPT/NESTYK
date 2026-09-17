import { formatBedroomSpec } from '../bedroom-label';
import { NearbyPlacesMap } from './NearbyPlacesMap';
import type { NearbyPlace } from '@nestyk/types';
import { Image } from 'expo-image';
import { initialPhotoLoad, photoLoadReducer } from './room-photo-load';
import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  Linking,
  ActivityIndicator,
  Pressable,
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ListRenderItemInfo,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import {
  MobileButton,
  MobileIcon,
  MobilePhotoViewer,
  getCardElevation,
  type AppIconName,
  type MobilePhotoViewerLabels,
  tokens,
  useMobileTheme,
} from '@nestyk/ui/native';

export type AgentRoomDetail = {
  id: number;
  listingTitle: string | null;
  description: string | null;
  roomId: string | null;
  visibility: 'private' | 'published' | null;
  roomStatusCode: string | null;
  roomTypeCode: string | null;
  roomTypeId: number | null;
  listingSourceCode: string | null;
  availableFromDate: string;
  property: {
    id: number;
    propertyTypeId: number | null;
    latitude: string | null;
    longitude: string | null;
    name: string;
    address: string;
    subdistrict: string;
    district: string;
    province: string;
    postalCode: string;
    propertyTypeCode: string | null;
  } | null;
  latitude: string | null;
  longitude: string | null;
  prices: {
    contractTypeId?: number;
    contractTypeCode: string;
    termMonths: number | null;
    price: number;
    advanceRentMonths?: number;
    depositMonths?: number;
  }[];
  advanceRentMonths: number;
  depositMonths: number;
  waterRatePerUnit: string | null;
  electricRatePerUnit: string | null;
  medias: { id: number; mediaUrl: string; mediaType: string; isCover: boolean }[];
  layout: { code: string; value: string }[];
  facilities: string[];
  nearbyOther: string | null;
  facilityItems?: { code: string; groupCode?: string }[];
  customFacilities?: string[];
  nearbyPlaces?: NearbyPlace[];
  documents?: {
    kind: 'id_passport' | 'bookbank' | 'ownership' | 'other';
    mediaUrl: string;
    sortOrder: number;
  }[];
  contacts: {
    id: number;
    name: string;
    phone: string;
    email: string | null;
    note: string | null;
    isPrimary: boolean;
  }[];
};

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (out, [key, value]) => out.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value)),
    template,
  );
}

function layoutValue(layout: { code: string; value: string }[], code: string) {
  return layout.find((item) => item.code === code)?.value?.trim() || null;
}

function formatDisplayDate(iso: string | null | undefined, locale: string) {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return date.toLocaleDateString(locale === 'th' ? 'th-TH' : `${locale}-u-ca-gregory`, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function statusTone(code: string | null) {
  if (code === 'available') {
    return {
      bg: tokens.colors.subtle.successBg,
      fg: tokens.colors.subtle.successFg,
      dot: tokens.colors.success,
    };
  }
  if (code === 'rented') {
    return {
      bg: '#F1F5F9',
      fg: tokens.colors.icon.secondary,
      dot: tokens.colors.icon.secondary,
    };
  }
  if (code === 'needs_edit') {
    return {
      bg: tokens.colors.subtle.dangerBg,
      fg: tokens.colors.subtle.dangerFg,
      dot: tokens.colors.danger,
    };
  }
  return {
    bg: tokens.colors.subtle.warningBg,
    fg: tokens.colors.subtle.warningFg,
    dot: tokens.colors.warning,
  };
}

function HeroPhoto({
  uri,
  width,
  height,
  fallback,
  retryLabel,
}: {
  uri: string;
  width: number;
  height: number;
  fallback: string;
  retryLabel: string;
}) {
  const [state, dispatch] = useReducer(photoLoadReducer, initialPhotoLoad);
  useEffect(() => {
    if (state.status !== 'loading') return;
    const timeout = setTimeout(() => dispatch({ type: 'timeout', attempt: state.attempt }), 8000);
    return () => clearTimeout(timeout);
  }, [state.attempt, state.status]);

  return (
    <View style={[styles.heroSlide, { width, height }]}>
      {state.status !== 'failed' ? (
        <Image
          key={`${uri}:${state.attempt}`}
          source={{ uri }}
          contentFit="cover"
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFillObject}
          onLoad={() => dispatch({ type: 'loaded', attempt: state.attempt })}
          onError={() => dispatch({ type: 'failed', attempt: state.attempt })}
        />
      ) : null}
      {state.status === 'loading' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.photoOverlay]}>
          <ActivityIndicator color={tokens.colors.brand[500]} />
        </View>
      ) : null}
      {state.status === 'failed' ? (
        <View style={[StyleSheet.absoluteFill, styles.photoOverlay]}>
          <Text style={styles.photoFallbackText}>{fallback}</Text>
          <MobileButton variant="outline" onPress={() => dispatch({ type: 'retry' })}>
            {retryLabel}
          </MobileButton>
        </View>
      ) : null}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: AppIconName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, last ? null : styles.infoRowBorder]}>
      <MobileIcon name={icon} size={18} color={tokens.colors.icon.secondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function TermRow({
  label,
  hint,
  value,
  last,
}: {
  label: string;
  hint?: string | null;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.termRow, last ? null : styles.termRowBorder]}>
      <View style={styles.termCopy}>
        <Text style={styles.termLabel}>
          {label}
          {hint ? <Text style={styles.termHintInline}>{` ${hint}`}</Text> : null}
        </Text>
      </View>
      <Text style={styles.termValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function LeaseTermCard({
  title,
  rentLabel,
  rentValue,
  summaryLine,
  advanceLabel,
  advanceHint,
  advanceValue,
  depositLabel,
  depositHint,
  depositValue,
  expanded,
  onToggle,
  surfaceColor,
}: {
  title: string;
  rentLabel: string;
  rentValue: string;
  summaryLine: string;
  advanceLabel: string;
  advanceHint: string;
  advanceValue: string;
  depositLabel: string;
  depositHint: string;
  depositValue: string;
  expanded: boolean;
  onToggle: () => void;
  surfaceColor: string;
}) {
  return (
    <View style={[styles.termCard, { backgroundColor: surfaceColor }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        android_ripple={{ color: '#00000014' }}
        style={({ pressed }) => [styles.termCardHeader, pressed ? { opacity: 0.88 } : null]}
      >
        <View style={styles.termCardHeaderCopy}>
          <Text style={styles.termCardTitle}>{title}</Text>
          {!expanded ? (
            <>
              <Text style={styles.termCardRent} selectable>
                {rentValue}
              </Text>
              <Text style={styles.termCardSummary} numberOfLines={1}>
                {summaryLine}
              </Text>
            </>
          ) : null}
        </View>
        <MobileIcon
          name={expanded ? 'chevron-down' : 'chevron-right'}
          size={18}
          color={tokens.colors.icon.secondary}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.termCardBody}>
          <TermRow label={rentLabel} value={rentValue} />
          <TermRow label={advanceLabel} hint={advanceHint} value={advanceValue} />
          <TermRow label={depositLabel} hint={depositHint} value={depositValue} last />
        </View>
      ) : null}
    </View>
  );
}

export function MobileAgentRoomBody({
  room,
  mapsApiKey,
}: {
  room: AgentRoomDetail;
  mapsApiKey?: string;
}) {
  const { t, locale } = useLocale();
  const { theme } = useMobileTheme();
  const { width } = useWindowDimensions();
  const copy = t.agent.listings;
  const cr = t.agent.createRoom;
  const [photoIndex, setPhotoIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [expandedLeaseKeys, setExpandedLeaseKeys] = useState<Set<string>>(() => {
    if (room.prices.length === 1) {
      const only = room.prices[0];
      return new Set([String(only.contractTypeId ?? `${only.contractTypeCode}-0`)]);
    }
    return new Set();
  });

  const photos = useMemo(
    () => room.medias.filter((m) => m.mediaType === 'image'),
    [room.medias],
  );
  const heroHeight = Math.round(Math.min(width * 0.62, 280));

  const bedroom = layoutValue(room.layout, 'bedroom');
  const bathroom = layoutValue(room.layout, 'bathroom');
  const sizeSqm = layoutValue(room.layout, 'room_size');
  const floor = layoutValue(room.layout, 'floor');

  const primaryPrice = useMemo(() => {
    if (!room.prices.length) return null;
    return room.prices.reduce((min, p) => (p.price < min.price ? p : min), room.prices[0]);
  }, [room.prices]);
  const sortedPrices = useMemo(
    () => [...room.prices].sort((a, b) => a.price - b.price || (b.termMonths ?? 0) - (a.termMonths ?? 0)),
    [room.prices],
  );
  const money = (amount: number) => new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'THB', maximumFractionDigits: 0,
  }).format(amount);

  const locationLine = useMemo(() => {
    if (!room.property) return null;
    return [room.property.district, room.property.province].filter((v) => v && v !== '-').join(', ');
  }, [room.property]);

  const address = room.property
    ? [room.property.address, room.property.subdistrict, room.property.district, room.property.province, room.property.postalCode]
        .filter((v) => v && v !== '-')
        .join(', ')
    : copy.notSpecified;

  const statusLabel =
    copy[room.roomStatusCode as keyof typeof copy] || room.roomStatusCode || copy.notSpecified;
  const statusColors = statusTone(room.roomStatusCode);
  const availableLabel = formatDisplayDate(room.availableFromDate, locale) || copy.notSpecified;

  const bedSpec = formatBedroomSpec(
    bedroom,
    {
      studio: t.masters.roomTypes.studio,
      one: copy.specBed,
      many: copy.specBeds,
    },
    room.roomTypeCode,
  );
  const bathSpec = bathroom
    ? interpolate(Number(bathroom) === 1 ? copy.specBath : copy.specBaths, { count: bathroom })
    : null;
  const sizeSpec = sizeSqm ? interpolate(copy.specSqm, { size: sizeSqm }) : null;
  const floorSpec = floor ? interpolate(copy.specFloor, { floor }) : null;

  const specs = [
    bedSpec ? { key: 'bed', icon: 'bed' as const, label: bedSpec } : null,
    bathSpec ? { key: 'bath', icon: 'bath' as const, label: bathSpec } : null,
    sizeSpec ? { key: 'sqm', icon: 'room-size' as const, label: sizeSpec } : null,
    floorSpec ? { key: 'floor', icon: 'stairs' as const, label: floorSpec } : null,
  ].filter(Boolean) as Array<{ key: string; icon: AppIconName; label: string }>;

  const viewerLabels: MobilePhotoViewerLabels = {
    titlePreview: cr.photoViewerTitle,
    titleCompare: cr.photoViewerCompareTitle,
    before: cr.photoBefore,
    after: cr.photoAfter,
    enhancedBadge: cr.photoViewerEnhancedBadge,
    enhancedCaption: cr.photoViewerEnhancedCaption,
    hintZoom: cr.photoViewerHintZoom,
    hintCompareSwitch: cr.photoViewerHintCompareSwitch,
    hintCompareClose: cr.photoViewerHintCompareClose,
    closeA11y: cr.closePhotoPreview,
  };

  const onHeroScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
      if (next !== photoIndex && next >= 0 && next < photos.length) setPhotoIndex(next);
    },
    [photoIndex, photos.length, width],
  );

  const renderHeroItem = useCallback(
    ({ item }: ListRenderItemInfo<(typeof photos)[number]>) => (
      <Pressable
        onPress={() => setViewerOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={cr.photoViewerTitle}
      >
        <HeroPhoto
          uri={item.mediaUrl}
          width={width}
          height={heroHeight}
          fallback={copy.photoLoadError}
          retryLabel={copy.retry}
        />
      </Pressable>
    ),
    [copy.photoLoadError, copy.retry, cr.photoViewerTitle, heroHeight, width],
  );

  const elevation = getCardElevation(1);
  const { boxShadow: _webOnly, ...cardElevation } = elevation;

  const roomInfoRows: Array<{ icon: AppIconName; label: string; value: string }> = [];
  if (room.listingTitle) {
    roomInfoRows.push({ icon: 'note', label: cr.listingTitle, value: room.listingTitle });
  }
  if (room.property?.propertyTypeCode || room.property?.name) {
    roomInfoRows.push({
      icon: 'buildings',
      label: cr.propertyType,
      value:
        t.masters.propertyTypes[
          room.property?.propertyTypeCode as keyof typeof t.masters.propertyTypes
        ] ||
        room.property?.propertyTypeCode ||
        copy.notSpecified,
    });
  }
  if (room.roomTypeCode) {
    roomInfoRows.push({
      icon: 'bed',
      label: cr.roomType,
      value:
        t.masters.roomTypes[room.roomTypeCode as keyof typeof t.masters.roomTypes] ||
        room.roomTypeCode,
    });
  }
  if (room.roomId) {
    roomInfoRows.push({ icon: 'note', label: cr.roomId, value: room.roomId });
  }
  if (room.property?.name) {
    roomInfoRows.push({ icon: 'buildings', label: cr.propertyName, value: room.property.name });
  }
  room.layout
    .filter((item) => !['bedroom', 'bathroom', 'room_size', 'floor'].includes(item.code))
    .forEach((item) => {
      const labels: Record<string, string> = {
        building: cr.building,
      };
      roomInfoRows.push({
        icon: 'buildings',
        label: labels[item.code] || item.code,
        value: item.value,
      });
    });

  return (
    <>
      <ScrollView
        style={[styles.root, { backgroundColor: theme.background || tokens.colors.background }]}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { height: heroHeight }]}>
          {photos.length ? (
            <>
              <FlatList
                data={photos}
                keyExtractor={(item) => String(item.id)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onHeroScroll}
                renderItem={renderHeroItem}
                getItemLayout={(_, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
              />
              <View style={styles.photoCountPill} pointerEvents="none">
                <Text style={styles.photoCountText}>
                  {photoIndex + 1} / {photos.length}
                </Text>
              </View>
            </>
          ) : (
            <View style={[styles.heroEmpty, { width, height: heroHeight }]}>
              <MobileIcon name="camera" size={28} color={tokens.colors.icon.secondary} />
              <Text style={styles.heroEmptyText}>{copy.noPhotos}</Text>
            </View>
          )}
        </View>

        <View style={[styles.summaryCard, cardElevation, { backgroundColor: theme.surface }]}>
          <Text style={styles.propertyTitle} numberOfLines={2}>
            {room.property?.name || room.listingTitle || `#${room.id}`}
          </Text>

          {locationLine ? (
            <View style={styles.locationRow}>
              <MobileIcon name="map-pin" size={14} color={tokens.colors.icon.secondary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {locationLine}
              </Text>
            </View>
          ) : null}

          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColors.dot }]} />
              <Text style={[styles.statusBadgeText, { color: statusColors.fg }]} numberOfLines={1}>
                {statusLabel}
              </Text>
            </View>
            <View style={styles.visibilityBadge}>
              <MobileIcon
                name={room.visibility === 'published' ? 'globe' : 'lock'}
                size={12}
                color={tokens.colors.icon.secondary}
              />
              <Text style={styles.visibilityText} numberOfLines={1}>
                {room.visibility === 'published'
                  ? cr.visibilityPublished
                  : cr.visibilityPrivate}
              </Text>
            </View>
          </View>

          <View style={styles.priceBox}>
            {primaryPrice && room.prices.length > 1 ? (
              <Text style={styles.availabilityLabel}>{copy.priceFrom}</Text>
            ) : null}
            <Text style={styles.priceText}>
              {primaryPrice != null
                ? interpolate(copy.rentPerMonth, {
                    price: primaryPrice.price.toLocaleString(),
                  })
                : copy.notSpecified}
            </Text>
            {primaryPrice?.termMonths != null ? (
              <Text style={styles.priceHint}>
                {interpolate(cr.leaseCardTitle, { months: primaryPrice.termMonths })}
              </Text>
            ) : null}
          </View>

          {specs.length ? (
            <View style={styles.specsRow}>
              {specs.map((spec) => (
                <View key={spec.key} style={styles.specItem}>
                  <View style={styles.specIcon}>
                    <MobileIcon name={spec.icon} size={20} color={tokens.colors.primary} />
                  </View>
                  <Text style={styles.specLabel}>
                    {spec.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.availabilityRow}>
            <View style={styles.availabilityIcon}>
              <MobileIcon name="calendar" size={18} color={tokens.colors.primary} />
            </View>
            <View style={styles.availabilityCopy}>
              <Text style={styles.availabilityLabel}>{copy.availabilityLabel}</Text>
              <Text style={styles.availabilityValue}>{availableLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sections}>
          <View style={styles.block}>
            <SectionTitle title={copy.rentAndTerms} />
            {room.prices.length ? (
              sortedPrices.map((price, index) => {
                const key = String(price.contractTypeId ?? `${price.contractTypeCode}-${index}`);
                const advance = price.advanceRentMonths ?? room.advanceRentMonths;
                const deposit = price.depositMonths ?? room.depositMonths;
                const advanceHint = interpolate(
                  advance === 1 ? copy.monthHint : copy.monthsHint,
                  { count: advance },
                );
                const depositHint = interpolate(
                  deposit === 1 ? copy.monthHint : copy.monthsHint,
                  { count: deposit },
                );
                const title =
                  price.termMonths != null
                    ? interpolate(copy.months, { count: price.termMonths })
                    : price.contractTypeCode;
                const expanded = expandedLeaseKeys.has(key);
                return (
                  <LeaseTermCard
                    key={key}
                    title={title}
                    rentLabel={cr.monthlyRent}
                    rentValue={money(price.price)}
                    summaryLine={interpolate(cr.leaseCardAdvanceDeposit, {
                      advance: interpolate(copy.months, { count: advance }),
                      deposit: interpolate(copy.months, { count: deposit }),
                    })}
                    advanceLabel={cr.advanceRent}
                    advanceHint={advanceHint}
                    advanceValue={money(price.price * advance)}
                    depositLabel={cr.deposit}
                    depositHint={depositHint}
                    depositValue={money(price.price * deposit)}
                    expanded={expanded}
                    surfaceColor={theme.surface}
                    onToggle={() => {
                      setExpandedLeaseKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      });
                    }}
                  />
                );
              })
            ) : (
              <View style={[styles.termCard, { backgroundColor: theme.surface }]}>
                <TermRow label={cr.monthlyRent} value={copy.notSpecified} last />
              </View>
            )}
            {(room.waterRatePerUnit || room.electricRatePerUnit) && (
              <View style={[styles.termCard, { backgroundColor: theme.surface }]}>
                {room.waterRatePerUnit ? (
                  <TermRow
                    label={cr.waterRate}
                    value={room.waterRatePerUnit}
                    last={!room.electricRatePerUnit}
                  />
                ) : null}
                {room.electricRatePerUnit ? (
                  <TermRow label={cr.electricRate} value={room.electricRatePerUnit} last />
                ) : null}
              </View>
            )}
          </View>

          {roomInfoRows.length || room.description ? (
            <View style={styles.block}>
              <SectionTitle title={copy.roomInformation} />
              {roomInfoRows.length ? (
                <View style={[styles.infoCard, { backgroundColor: theme.surface }]}>
                  {roomInfoRows.map((row, index) => (
                    <InfoRow
                      key={`${row.label}-${index}`}
                      icon={row.icon}
                      label={row.label}
                      value={row.value}
                      last={index === roomInfoRows.length - 1 && !room.description}
                    />
                  ))}
                  {room.description ? (
                    <View style={styles.infoRow}>
                      <MobileIcon name="note" size={18} color={tokens.colors.icon.secondary} />
                      <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                        <Text style={styles.infoLabel}>{cr.listingDescription}</Text>
                        <Text style={styles.infoValueLeft} selectable>
                          {room.description}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : room.description ? (
                <View style={[styles.infoCard, { backgroundColor: theme.surface, padding: 14 }]}>
                  <Text style={styles.infoValueLeft} selectable>
                    {room.description}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.block}>
            <SectionTitle title={cr.address} />
            <View style={[styles.infoCard, { backgroundColor: theme.surface, padding: 14, gap: 12 }]}>
              <Text style={styles.infoValueLeft} selectable>
                {address}
              </Text>
              {room.latitude != null && room.longitude != null ? (
                <MobileButton
                  variant="outline"
                  onPress={() => {
                    void Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${room.latitude},${room.longitude}`,
                      )}`,
                    );
                  }}
                >
                  {copy.openMap}
                </MobileButton>
              ) : null}
            </View>
          </View>

          {room.facilities.length > 0 || !!room.customFacilities?.length ? (
            <View style={styles.block}>
              <SectionTitle title={cr.steps.facilities} />
              <View style={[styles.infoCard, { backgroundColor: theme.surface, padding: 14, gap: 10 }]}>
                {room.facilityItems?.length ? (
                  [...new Set(room.facilityItems.map((f) => f.groupCode ?? 'other'))].map(
                    (group) => (
                      <View key={group} style={{ gap: 4 }}>
                        <Text style={styles.groupHeading}>
                          {t.masters.facilityGroups[group] ?? group}
                        </Text>
                        <Text style={styles.infoValueLeft}>
                          {room
                            .facilityItems!.filter((f) => (f.groupCode ?? 'other') === group)
                            .map((f) => t.masters.facilities[f.code] ?? f.code)
                            .join(' · ')}
                        </Text>
                      </View>
                    ),
                  )
                ) : (
                  <Text style={styles.infoValueLeft}>
                    {room.facilities.map((code) => t.masters.facilities[code] ?? code).join(' · ')}
                  </Text>
                )}
                {!!room.customFacilities?.length && (
                  <View style={{ gap: 4 }}>
                    <Text style={styles.groupHeading}>{cr.customFacilities}</Text>
                    <Text style={styles.infoValueLeft}>{room.customFacilities.join(' · ')}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}

          {!!room.nearbyPlaces?.length || room.nearbyOther ? (
            <View style={styles.block}>
              <SectionTitle title={cr.steps.nearby} />
              <View style={[styles.infoCard, { backgroundColor: theme.surface, padding: 14, gap: 10 }]}>
                {!!room.nearbyPlaces?.length &&
                room.latitude != null &&
                room.longitude != null ? (
                  <NearbyPlacesMap
                    latitude={Number(room.latitude)}
                    longitude={Number(room.longitude)}
                    places={room.nearbyPlaces}
                    selectedIds={room.nearbyPlaces.map((p) => p.placeId)}
                    apiKey={mapsApiKey}
                    readOnly
                  />
                ) : null}
                {room.nearbyPlaces?.map((place) => (
                  <View key={place.placeId} style={styles.nearbyRow}>
                    <Text style={styles.nearbyName} numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text style={styles.nearbyDistance}>
                      {interpolate(cr.distanceStraight, {
                        meters: place.distanceMeters.toLocaleString(),
                      })}
                    </Text>
                  </View>
                ))}
                {room.nearbyOther ? (
                  <Text style={styles.infoValueLeft}>{room.nearbyOther}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {!!room.documents?.length ? (
            <View style={styles.block}>
              <SectionTitle title={cr.steps.documents} />
              <View style={{ gap: 8 }}>
                {room.documents.map((document, index) => (
                  <MobileButton
                    key={index}
                    variant="outline"
                    onPress={() => {
                      try {
                        const url = new URL(document.mediaUrl);
                        if (url.protocol === 'https:') void Linking.openURL(url.toString());
                      } catch {
                        /* Invalid legacy links cannot be opened. */
                      }
                    }}
                  >
                    {cr.documentKinds[document.kind]} {index + 1}
                  </MobileButton>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.block}>
            <SectionTitle title={cr.sourceSection} />
            <View style={[styles.infoCard, { backgroundColor: theme.surface, padding: 14, gap: 12 }]}>
              {(room.listingSourceCode === 'owner' || room.listingSourceCode === 'co_agent') && (
                <Text style={styles.groupHeading}>
                  {room.listingSourceCode === 'owner' ? cr.sourceOwner : cr.sourceCoAgent}
                </Text>
              )}
              {!room.contacts.length ? (
                <Text style={styles.muted}>{copy.notSpecified}</Text>
              ) : (
                room.contacts.map((contact) => (
                  <View key={contact.id} style={{ gap: 4 }}>
                    <Text style={styles.contactName} selectable>
                      {contact.name}
                    </Text>
                    <Text style={styles.infoValueLeft} selectable>
                      {contact.phone}
                    </Text>
                    {contact.email ? (
                      <Text style={styles.muted} selectable>
                        {contact.email}
                      </Text>
                    ) : null}
                    {contact.note ? (
                      <Text style={styles.muted} selectable>
                        {contact.note}
                      </Text>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      <MobilePhotoViewer
        visible={viewerOpen}
        mode="gallery"
        items={photos.map((p) => ({ uri: p.mediaUrl }))}
        index={photoIndex}
        onIndexChange={setPhotoIndex}
        labels={viewerLabels}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingBottom: 40 },
  hero: {
    width: '100%',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  heroSlide: {
    backgroundColor: '#E2E8F0',
  },
  heroEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E2E8F0',
  },
  heroEmptyText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
  },
  photoOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(248,250,252,0.72)',
    padding: 16,
  },
  photoFallbackText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textHeading,
    textAlign: 'center',
  },
  photoCountPill: {
    position: 'absolute',
    right: 12,
    bottom: 28,
    backgroundColor: 'rgba(33,30,30,0.72)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  photoCountText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  summaryCard: {
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  propertyTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F1F5F9',
  },
  visibilityText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  priceBox: {
    backgroundColor: tokens.colors.brand[50],
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.brand[500],
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  priceText: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  priceHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 4,
  },
  specItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  specLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textHeading,
    textAlign: 'center',
  },
  specIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.brand[50],
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
    marginTop: 4,
    paddingTop: 12,
  },
  availabilityIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  availabilityLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  availabilityValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  sections: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 20,
  },
  block: { gap: 10 },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: tokens.colors.brand[500],
  },
  sectionTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  termCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  termCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  termCardHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  termCardTitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: tokens.colors.textHeading,
  },
  termCardRent: {
    fontFamily: tokens.typography.native.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  termCardSummary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  termCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  termRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  termCopy: { flex: 1, minWidth: 0, gap: 2 },
  termLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textHeading,
  },
  termHintInline: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
    color: tokens.colors.textSecondary,
  },
  termHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  termValue: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.primary,
    textAlign: 'right',
  },
  infoCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
  },
  infoLabel: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.primary,
    textAlign: 'right',
  },
  infoValueLeft: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.primary,
  },
  groupHeading: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nearbyName: {
    flex: 1,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textHeading,
  },
  nearbyDistance: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  contactName: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  muted: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
});
