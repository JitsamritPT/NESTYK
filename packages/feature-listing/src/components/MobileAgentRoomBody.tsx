import { NearbyPlacesMap } from './NearbyPlacesMap';
import type { NearbyPlace } from '@nestyk/types';
import { Image } from 'expo-image';
import { initialPhotoLoad, photoLoadReducer } from './room-photo-load';
import React, { useReducer, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions, Linking, ActivityIndicator } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileBadge, tokens, useMobileTheme } from '@nestyk/ui/native';

export type AgentRoomDetail = {
  id: number; listingTitle: string | null; description: string | null; roomId: string | null;
  visibility: 'private' | 'published' | null; roomStatusCode: string | null;
  roomTypeCode: string | null; roomTypeId: number | null; listingSourceCode: string | null; availableFromDate: string;
  property: { id: number; propertyTypeId: number | null; latitude: string | null; longitude: string | null; name: string; address: string; subdistrict: string; district: string; province: string; postalCode: string; propertyTypeCode: string | null } | null;
  latitude: string | null; longitude: string | null;
  prices: { contractTypeId?: number; contractTypeCode: string; termMonths: number | null; price: number }[];
  advanceRentMonths: number; depositMonths: number; waterRatePerUnit: string | null; electricRatePerUnit: string | null;
  medias: { id: number; mediaUrl: string; mediaType: string; isCover: boolean }[];
  layout: { code: string; value: string }[]; facilities: string[]; nearbyOther: string | null;
  facilityItems?: { code: string; groupCode?: string }[];
  customFacilities?: string[];
  nearbyPlaces?: NearbyPlace[];
  documents?: { kind: 'id_passport' | 'bookbank' | 'ownership' | 'other'; mediaUrl: string; sortOrder: number }[];
  contacts: { id: number; name: string; phone: string; email: string | null; note: string | null; isPrimary: boolean }[];
};

function Photo({ uri, width, fallback, retryLabel }: { uri: string; width: number; fallback: string; retryLabel: string }) {
  const [state, dispatch] = useReducer(photoLoadReducer, initialPhotoLoad);
  useEffect(() => {
    if (state.status !== 'loading') return;
    const timeout = setTimeout(() => dispatch({ type: 'timeout', attempt: state.attempt }), 8000);
    return () => clearTimeout(timeout);
  }, [state.attempt, state.status]);
  return <View style={[styles.photo, { width, overflow: 'hidden' }]}>
    {state.status !== 'failed' && <Image
      key={`${uri}:${state.attempt}`} source={{ uri }} contentFit="contain" cachePolicy="memory-disk"
      style={{ width: '100%', height: '100%' }}
      onLoad={() => dispatch({ type: 'loaded', attempt: state.attempt })}
      onError={() => dispatch({ type: 'failed', attempt: state.attempt })}
    />}
    {state.status === 'loading' && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.photoOverlay]}><ActivityIndicator color={tokens.colors.roles.agent} /></View>}
    {state.status === 'failed' && <View style={[StyleSheet.absoluteFill, styles.photoOverlay]}><Text>{fallback}</Text><MobileButton variant="outline" onPress={() => dispatch({ type: 'retry' })}>{retryLabel}</MobileButton></View>}
  </View>;
}

export function MobileAgentRoomBody({ room, mapsApiKey }: { room: AgentRoomDetail; mapsApiKey?: string }) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const { width } = useWindowDimensions();
  const copy = t.agent.listings;
  const cr = t.agent.createRoom;
  const photoWidth = Math.min(width - 32, 680);
  const photos = room.medias.filter((m) => m.mediaType === 'image');
  const row = (label: string, value: string | number | null | undefined) => (
    <View key={label} style={styles.row}><Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text><Text selectable style={[styles.value, { color: theme.textHeading }]}>{value ?? copy.notSpecified}</Text></View>
  );
  const section = (title: string, content: React.ReactNode) => <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}><Text style={[styles.heading, { color: theme.textHeading }]}>{title}</Text>{content}</View>;
  const layoutLabels: Record<string, string> = { bedroom: cr.bedroom, bathroom: cr.bathroom, room_size: cr.sizeSqm, floor: cr.floor, building: cr.building };
  const address = room.property ? [room.property.address, room.property.subdistrict, room.property.district, room.property.province, room.property.postalCode].filter((v) => v && v !== '-').join(', ') : copy.notSpecified;
  return <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
    <Text style={[styles.title, { color: theme.textHeading }]}>{room.listingTitle || room.property?.name || `#${room.id}`}</Text>
    <View style={styles.badges}><MobileBadge role="agent" label={room.visibility === 'published' ? cr.visibilityPublished : cr.visibilityPrivate} /><Text style={{ color: theme.textSecondary }}>{copy[room.roomStatusCode as keyof typeof copy] || room.roomStatusCode}</Text></View>
    {photos.length ? <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator>{photos.map((photo, index) => <View key={photo.id}><Photo key={photo.mediaUrl} uri={photo.mediaUrl} width={photoWidth} fallback={copy.photoLoadError} retryLabel={copy.retry} /><Text style={[styles.caption, { color: theme.textSecondary }]}>{index + 1} / {photos.length}{photo.isCover ? ` · ${cr.coverPhoto}` : ''}</Text></View>)}</ScrollView> : <Text style={{ color: theme.textSecondary }}>{copy.noPhotos}</Text>}
    {section(copy.details, <>
      {row(cr.propertyName, room.property?.name)}
      {row(cr.propertyType, t.masters.propertyTypes[room.property?.propertyTypeCode as keyof typeof t.masters.propertyTypes] || room.property?.propertyTypeCode)}
      {row(cr.roomId, room.roomId)}
      {row(cr.roomType, t.masters.roomTypes[room.roomTypeCode as keyof typeof t.masters.roomTypes] || room.roomTypeCode)}
      {room.layout.map((item) => row(layoutLabels[item.code] || item.code, item.value))}
      {row(cr.availableFrom, room.availableFromDate)}
      {room.description ? <Text selectable style={{ color: theme.textHeading }}>{room.description}</Text> : null}
    </>)}
    {section(cr.steps.pricing, <>
      {room.prices.map((price) => row(price.termMonths ? copy.months.replace('{count}', String(price.termMonths)) : price.contractTypeCode, t.agent.listings.rentPerMonth.replace('{price}', price.price.toLocaleString())))}
      {!room.prices.length ? row(cr.monthlyRent, null) : null}
      {row(cr.advanceRent, copy.months.replace('{count}', String(room.advanceRentMonths)))}
      {row(cr.deposit, copy.months.replace('{count}', String(room.depositMonths)))}
      {row(cr.waterRate, room.waterRatePerUnit)}{row(cr.electricRate, room.electricRatePerUnit)}
    </>)}
    {section(cr.address, <><Text selectable style={{ color: theme.textHeading }}>{address}</Text>{room.latitude != null && room.longitude != null && <MobileButton variant="outline" onPress={() => { void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${room.latitude},${room.longitude}`)}`); }}>{copy.openMap}</MobileButton>}</>)}
    {room.facilities.length > 0 && section(cr.steps.facilities, <>
      {room.facilityItems ? [...new Set(room.facilityItems.map((f) => f.groupCode ?? 'other'))].map((group) => <View key={group} style={{ gap: 6 }}>
        <Text style={[styles.heading, { color: theme.textHeading }]}>{t.masters.facilityGroups[group] ?? group}</Text>
        <Text style={{ color: theme.textHeading }}>{room.facilityItems!.filter((f) => (f.groupCode ?? 'other') === group).map((f) => t.masters.facilities[f.code] ?? f.code).join(' · ')}</Text>
      </View>) : <Text style={{ color: theme.textHeading }}>{room.facilities.map((code) => t.masters.facilities[code] ?? code).join(' · ')}</Text>}
      {!!room.customFacilities?.length && <View style={{ gap: 6 }}><Text style={[styles.heading, { color: theme.textHeading }]}>{cr.customFacilities}</Text><Text style={{ color: theme.textHeading }}>{room.customFacilities.join(' · ')}</Text></View>}
    </>)}
    {!!room.nearbyPlaces?.length && section(cr.steps.nearby, <>
      {room.latitude != null && room.longitude != null && <NearbyPlacesMap latitude={Number(room.latitude)} longitude={Number(room.longitude)} places={room.nearbyPlaces} selectedIds={room.nearbyPlaces.map((p) => p.placeId)} apiKey={mapsApiKey} readOnly />}
      {room.nearbyPlaces.map((place) => row(place.name, cr.distanceStraight.replace('{meters}', place.distanceMeters.toLocaleString())))}
    </>)}
    {room.nearbyOther && section(cr.steps.nearby, <Text style={{ color: theme.textHeading }}>{room.nearbyOther}</Text>)}
    {!!room.documents?.length && section(cr.steps.documents, <>{room.documents.map((document, index) => <MobileButton key={index} variant="outline" onPress={() => {
      try { const url = new URL(document.mediaUrl); if (url.protocol === 'https:') void Linking.openURL(url.toString()); } catch { /* Invalid legacy links cannot be opened. */ }
    }}>{cr.documentKinds[document.kind]} {index + 1}</MobileButton>)}</>)}
    {section(copy.contacts, <>
      {row(cr.sourcePrompt, room.listingSourceCode === 'owner' ? cr.sourceOwner : room.listingSourceCode === 'co_agent' ? cr.sourceCoAgent : null)}
      {!room.contacts.length && <Text style={{ color: theme.textSecondary }}>{copy.notSpecified}</Text>}
      {room.contacts.map((contact) => <View key={contact.id} style={{ gap: 6, paddingVertical: 8 }}><Text selectable style={[styles.heading, { color: theme.textHeading }]}>{contact.name}</Text><Text selectable style={{ color: theme.textHeading }}>{contact.phone}</Text>{contact.email && <Text selectable style={{ color: theme.textSecondary }}>{contact.email}</Text>}{contact.note && <Text selectable style={{ color: theme.textSecondary }}>{contact.note}</Text>}</View>)}
    </>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 40, maxWidth: 712, width: '100%', alignSelf: 'center' },
  title: { fontFamily: tokens.typography.native.headingTh, fontSize: 24, lineHeight: 34 },
  heading: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 26 },
  section: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  row: { flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  label: { flex: 1, fontSize: 14 }, value: { flex: 1, fontSize: 14, textAlign: 'right' },
  photoOverlay: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  photo: { height: 280, backgroundColor: '#e2e8f0', borderRadius: 12 },
  caption: { textAlign: 'center', paddingTop: 8 },
});
