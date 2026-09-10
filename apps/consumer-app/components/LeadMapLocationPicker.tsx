import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { NearbyPlacesMap, type PlaceDetails, type PlaceSuggestion } from '@nestyk/feature-listing';
import { useLocale } from '@nestyk/i18n';
import { MobileButton, MobileIcon, MobileInput, tokens, useMobileTheme } from '@nestyk/ui/native';
import { getPlaceDetails, reverseMapLocation, searchPlaces } from '../lib/places-api';

export type LeadMapPin = { locations: string[]; locationPlaceId: string; locationName: string; latitude: number; longitude: number; radiusKm: number };
export function LeadMapLocationPicker({ pin, province, disabled, onChange, onResolving }: {
  pin: LeadMapPin | null; province: string; disabled: boolean;
  onChange: (pin: LeadMapPin | null, province?: string) => void;
  onResolving: (value: boolean) => void;
}) {
  const { t, locale } = useLocale(); const c = t.agent.leads; const { theme } = useMobileTheme();
  const [query, setQuery] = useState(''); const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false); const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const request = useRef(0);
  useEffect(() => () => { request.current += 1; }, []);
  useEffect(() => {
    let active = true; setItems([]); setError('');
    if (query.trim().length < 2) { setSearching(false); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      searchPlaces(query.trim(), locale).then((rows) => { if (active) setItems(rows); })
        .catch(() => { if (active) setError(c.mapSearchFailed); })
        .finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query, locale, attempt, c.mapSearchFailed]);
  const resolve = async (load: () => Promise<PlaceDetails>) => {
    const seq = ++request.current; setResolving(true); onResolving(true); setError('');
    try {
      const place = await load();
      if (seq !== request.current) return;
      if (!place.province) throw new Error(c.mapThailand);
      onChange({ locations: place.district ? [place.district.replace(/^(เขต|อำเภอ)\s*/, '').trim()].filter(Boolean) : [], locationPlaceId: place.placeId, locationName: place.name || place.address, latitude: place.latitude, longitude: place.longitude, radiusKm: pin?.radiusKm ?? 3 }, place.province);
      setQuery(''); setItems([]);
    } catch { if (seq === request.current) setError(c.mapSearchFailed); }
    finally { if (seq === request.current) { setResolving(false); onResolving(false); } }
  };
  return <View style={{ gap: 12 }}>
    <Text style={{ color: theme.textHeading, fontFamily: tokens.typography.native.headingTh }}>{c.mapLocation}</Text>
    <MobileInput placeholder={c.mapSearchHint} value={query} editable={!disabled && !resolving} onChangeText={setQuery} />
    <View style={{ height: 72, justifyContent: 'center', gap: 4 }}>
      <Text numberOfLines={2} style={{ color: theme.textHeading }}>{pin?.locationName || c.mapSearchHint}</Text>
      <Text numberOfLines={1} style={{ color: theme.textSecondary, fontSize: 12 }}>{c.province}: {province || c.unknown}</Text>
    </View>
    <View style={{ height: 330, borderRadius: 14, overflow: 'hidden', backgroundColor: theme.background }}>
      {pin ? <NearbyPlacesMap showRecenter={false} latitude={pin.latitude} longitude={pin.longitude} markerTitle={pin.locationName} radiusKm={pin.radiusKm} places={[]} selectedIds={[]} customMode readOnly={disabled || resolving} apiKey={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY} onMapPress={(lat, lng) => void resolve(() => reverseMapLocation(lat, lng))} />
        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 14 }}>
          <MobileIcon name="map-pin" size={32} color={theme.textSecondary} />
          <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>{c.mapSearchHint}</Text>
        </View>}
      {(searching || resolving || !!error || query.trim().length >= 2) && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, maxHeight: 330, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 8 }}>
        {(searching || resolving) && <ActivityIndicator color={tokens.colors.roles.agent} />}
        {!!error && <Text accessibilityRole="alert" style={{ color: theme.textSecondary }}>{error}</Text>}
        {!!error && !!query && <MobileButton variant="outline" onPress={() => setAttempt((n) => n + 1)}>{c.retry}</MobileButton>}
        {!searching && !resolving && !error && !items.length && <Text style={{ color: theme.textSecondary }}>{t.agent.createRoom.placesEmpty}</Text>}
        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ flexShrink: 1 }}>
          {items.map((item) => <Pressable key={item.placeId} accessibilityRole="button" disabled={disabled || resolving} onPress={() => void resolve(() => getPlaceDetails(item.placeId, 'th'))} style={{ paddingVertical: 12, gap: 4, borderBottomWidth: 1, borderColor: theme.border }}>
            <Text style={{ color: theme.textHeading }}>{item.name}</Text><Text style={{ color: theme.textSecondary, fontSize: 12 }}>{item.address}</Text>
          </Pressable>)}
        </ScrollView>
        {items.length > 0 && <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Google Maps</Text>}
      </View>}
    </View>
    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{c.mapPinHint}</Text>
    <Text style={{ color: theme.textHeading }}>{c.mapRadius}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{[1, 3, 5].map((km) => <Pressable key={km} disabled={!pin || disabled || resolving} accessibilityRole="radio" accessibilityState={{ checked: pin?.radiusKm === km, disabled: !pin || disabled || resolving }} onPress={() => { if (pin) onChange({ ...pin, radiusKm: km }); }} style={{ minHeight: 44, padding: 12, borderWidth: 1, borderRadius: 12, borderColor: pin?.radiusKm === km ? tokens.colors.roles.agent : theme.border, opacity: pin ? 1 : 0.5 }}>
      <Text style={{ color: pin?.radiusKm === km ? tokens.colors.roles.agent : theme.textHeading }}>{c.mapWithin.replace('{km}', String(km))}</Text>
    </Pressable>)}</View>
    <MobileButton variant="outline" disabled={!pin || disabled || resolving} onPress={() => onChange(null)}>{c.removePin}</MobileButton>
  </View>;
}
