import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, getCardElevation, tokens } from '@nestyk/ui/native';
import {
  nearbyCategory,
  categoryColors,
  type NearbyMapProps,
} from '../nearby';

const BRAND = tokens.colors.brand[500];
const BRAND_INK = tokens.colors.primary;
const MIN_DELTA = 0.004;
const MAX_DELTA = 0.2;
const ZOOM_FACTOR = 0.6;

const pinIcons = { transit: 'bus', education: 'note', health: 'heart', shopping: 'package', recreation: 'tree', other: 'map-pin' } as const;

function defaultDelta(compact: boolean) {
  return compact ? 0.028 : 0.04;
}

export function NearbyPlacesMap({
  latitude,
  longitude,
  markerTitle,
  places,
  selectedIds,
  customMode,
  activeId,
  onPlacePress,
  onMapPress,
  readOnly,
  compact = false,
  mapHeight,
  square = false,
  fillContainer = false,
  showFullscreenControl = true,
  onFullscreenPress,
  locked = true,
  onLockedChange,
  unlockLabel,
  lockLabel,
}: NearbyMapProps) {
  const { t } = useLocale();
  const cr = t.agent.createRoom;
  const map = useRef<MapView>(null);
  const [tracksProperty, setTracksProperty] = useState(true);
  const [delta, setDelta] = useState(() => defaultDelta(compact));
  const [ready, setReady] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const coordinates = useMemo(() => [{ latitude, longitude }, ...places.map(p => ({ latitude: p.latitude, longitude: p.longitude }))], [latitude, longitude, places]);
  const boundsKey = JSON.stringify(coordinates);
  const fitAll = () => map.current?.fitToCoordinates(coordinates, {
    edgePadding: { top: compact ? 24 : 48, right: 48, bottom: compact ? 44 : 70, left: 24 }, animated: true,
  });
  useEffect(() => { if (ready && !customMode) fitAll(); }, [ready, boundsKey, customMode]);
  const elevation = getCardElevation(1);
  const interactive = !locked && !readOnly;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const region = {
    latitude,
    longitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };

  useEffect(() => {
    setDelta(defaultDelta(compact));
  }, [latitude, longitude, compact]);

  useEffect(() => {
    map.current?.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    });
  }, [latitude, longitude, compact, delta]);

  useEffect(() => {
    setTracksProperty(true);
    const timer = setTimeout(() => setTracksProperty(false), 500);
    return () => clearTimeout(timer);
  }, [latitude, longitude, markerTitle, boundsKey, focused, activeId, selectedIds.join('|'), ready]);

  const zoomBy = (factor: number) => {
    setDelta((prev) => {
      const next = Math.min(MAX_DELTA, Math.max(MIN_DELTA, prev * factor));
      return next;
    });
  };

  const height = fillContainer
    ? undefined
    : mapHeight ?? (compact ? 180 : 320);

  return (
    <View
      style={[
        styles.wrap,
        fillContainer ? styles.wrapFill : square ? { width: '100%', aspectRatio: 1 } : { height },
      ]}
    >
      <MapView
        ref={map}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onMapReady={() => setReady(true)}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        pitchEnabled={false}
        rotateEnabled={false}
        onPress={(event) => {
          if (!interactive || !customMode) return;
          if (event.nativeEvent.action === 'marker-press') return;
          onMapPress?.(
            event.nativeEvent.coordinate.latitude,
            event.nativeEvent.coordinate.longitude,
          );
        }}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={markerTitle ?? cr.propertyName}
          anchor={{ x: 0.5, y: 1 }}
          zIndex={100}
          tracksViewChanges={tracksProperty}
        >
          <View style={styles.markerWrap} collapsable={false}>
            <View style={styles.markerBubble}>
              <MobileIcon name="buildings" size={16} color={BRAND_INK} />
            </View>
            <View style={styles.markerTip} />
          </View>
        </Marker>
        {places.map((place) => {
          const cat = nearbyCategory(place.type);
          const checked = selectedSet.has(place.placeId);
          const active = (focused ?? activeId) === place.placeId;
          return (
            <Marker
              key={place.placeId}
              coordinate={{
                latitude: place.latitude,
                longitude: place.longitude,
              }}
              title={place.name || place.placeId}
              description={`${cr.nearbyDistanceMeters.replace('{meters}', String(place.distanceMeters))} · ${cr.nearbyStraightLine}${readOnly ? '' : ` · ${checked ? cr.nearbyPinRemove : cr.nearbyPinSelect}`}`}
              zIndex={active ? 50 : checked ? 20 : 10}
              tracksViewChanges={tracksProperty}
              onPress={(event) => {
                event.stopPropagation();
                setFocused(place.placeId);
              }}
              onCalloutPress={() => { if (!readOnly) onPlacePress?.(place); }}
            >
              <View collapsable={false} style={{ padding: 5 }}>
                <View style={[styles.markerBubble, { backgroundColor: checked ? categoryColors[cat] : '#94A3B8', borderColor: active ? BRAND_INK : '#FFFFFF', borderWidth: active ? 3 : 2 }]}>
                  <MobileIcon name={pinIcons[cat]} size={16} color="#FFFFFF" />
                </View>
                {checked && <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#FFFFFF', borderRadius: 8, padding: 2 }}><MobileIcon name="check" size={12} color={categoryColors[cat]} /></View>}
              </View>
            </Marker>
          );
        })}
      </MapView>

      <Pressable accessibilityRole="button" accessibilityLabel={cr.nearbyFitAll} onPress={fitAll} style={[styles.fab, { left: 10, top: 10, width: 44, height: 44 }, elevation]}>
        <MobileIcon name="room-size" size={18} color={BRAND_INK} />
      </Pressable>

      <View style={[styles.zoomStack, elevation]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cr.nearbyZoomIn}
          onPress={() => zoomBy(ZOOM_FACTOR)}
          style={styles.zoomBtn}
        >
          <MobileIcon name="plus" size={16} color={tokens.colors.textHeading} />
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cr.nearbyZoomOut}
          onPress={() => zoomBy(1 / ZOOM_FACTOR)}
          style={styles.zoomBtn}
        >
          <Text style={styles.zoomMinus}>−</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cr.recenterMap}
        onPress={() => {
          const next = defaultDelta(compact);
          setDelta(next);
          map.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: next,
            longitudeDelta: next,
          });
        }}
        style={[styles.fab, styles.fabRecenter, elevation]}
      >
        <MobileIcon name="map-pin" size={16} color={tokens.colors.textHeading} />
      </Pressable>

      {showFullscreenControl && onFullscreenPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            fillContainer ? cr.nearbyExitFullscreen : cr.nearbyFullscreen
          }
          onPress={onFullscreenPress}
          style={[styles.fab, styles.fabFullscreen, elevation]}
        >
          <MobileIcon
            name={fillContainer ? 'close' : 'room-size'}
            size={16}
            color={tokens.colors.textHeading}
          />
        </Pressable>
      ) : null}

      {onLockedChange ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: !locked }}
          onPress={() => onLockedChange(!locked)}
          style={[
            styles.lockBtn,
            !locked && styles.lockBtnOn,
            elevation,
          ]}
        >
          <MobileIcon
            name={locked ? 'lock' : 'globe'}
            size={14}
            color={locked ? tokens.colors.textHeading : BRAND_INK}
          />
          <Text style={[styles.lockBtnText, !locked && styles.lockBtnTextOn]}>
            {locked
              ? unlockLabel ?? cr.nearbyUnlockMap
              : lockLabel ?? cr.nearbyLockMap}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: tokens.colors.border,
    position: 'relative',
  },
  wrapFill: {
    flex: 1,
    borderRadius: 0,
  },
  map: { width: '100%', height: '100%' },
  markerWrap: { alignItems: 'center' },
  markerBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: BRAND,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerTip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: BRAND,
  },
  zoomStack: {
    position: 'absolute',
    right: 10,
    top: 10,
    borderRadius: 10,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: tokens.colors.border,
  },
  zoomMinus: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '600',
    color: tokens.colors.textHeading,
    marginTop: -2,
  },
  fab: {
    position: 'absolute',
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabRecenter: { bottom: 10 },
  fabFullscreen: { bottom: 54 },
  lockBtn: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: tokens.colors.white,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockBtnOn: {
    backgroundColor: tokens.colors.subtle.brandBg,
    borderColor: BRAND,
  },
  lockBtnText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  lockBtnTextOn: { color: BRAND_INK },
});
