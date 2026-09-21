import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@nestyk/i18n';
import {
  MobileIcon,
  MobileInput,
  type AppIconName,
  tokens,
} from '@nestyk/ui/native';
import { NearbyPlacesMap } from './NearbyPlacesMap';
import {
  nearbyCategories,
  nearbyCategory,
  categoryColors,
  createCustomPlace,
  distanceMeters,
  formatTransitPlaceName,
  isCustomPlace,
  relocateNearby,
  type NearbyCategory,
  type NearbyPlace,
} from '../nearby';

export type NearbySearch = (
  latitude: number,
  longitude: number,
) => Promise<NearbyPlace[]>;

const BRAND = tokens.colors.brand[500];
const MAX_SELECTED = 24;
const MAX_CUSTOM = 5;
const PENDING_CUSTOM = '__pending_custom__';

const CATALOG_CATEGORIES = nearbyCategories.filter((c) => c !== 'other');

const CATEGORY_ICONS: Record<NearbyCategory, AppIconName> = {
  transit: 'train',
  education: 'note',
  health: 'heart',
  shopping: 'package',
  recreation: 'tree',
  other: 'map-pin',
};

function interpolate(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    template,
  );
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters.toLocaleString()} m`;
}

type Tab = 'all' | 'selected';

export function RoomNearbyEditor({
  latitude,
  longitude,
  value,
  onChange,
  search,
  apiKey,
  color: _accent,
  error,
  propertyName,
  address,
}: {
  latitude: number | null;
  longitude: number | null;
  value: NearbyPlace[];
  onChange: (places: NearbyPlace[]) => void;
  search?: NearbySearch;
  apiKey?: string;
  color: string;
  error?: string;
  propertyName?: string;
  address?: string;
}) {
  const { t } = useLocale();
  const cr = t.agent.createRoom;
  const insets = useSafeAreaInsets();
  const [searched, setSearched] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<NearbyCategory | null>('transit');
  const [mapLocked, setMapLocked] = useState(true);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  /** When set, map taps move this custom pin only — not open for all edits. */
  const [pinningPlaceId, setPinningPlaceId] = useState<string | null>(null);
  const seq = useRef(0);
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    seq.current++;
    setSuggestions([]);
    setSearched(false);
    setTab('all');
    setLoadError(false);
    setLoading(false);
    setMapLocked(true);
    setMapFullscreen(false);
    setActiveId(null);
    setExpanded('transit');
    setPinningPlaceId(null);
    return () => {
      seq.current++;
    };
  }, [latitude, longitude]);

  useEffect(() => {
    if (!mapFullscreen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setMapFullscreen(false);
      return true;
    });
    return () => sub.remove();
  }, [mapFullscreen]);

  const catalog = useMemo(
    () => value.filter((p) => !isCustomPlace(p)),
    [value],
  );
  const custom = useMemo(() => value.filter(isCustomPlace), [value]);
  const ids = useMemo(() => value.map((p) => p.placeId), [value]);
  const selectedCount = value.length;
  const otherOpen = expanded === 'other';
  const pinning = pinningPlaceId != null;

  const foundByCategory = useMemo(() => {
    const map = new Map<NearbyCategory, NearbyPlace[]>();
    for (const code of CATALOG_CATEGORIES) {
      const fromSearch = suggestions.filter((p) => nearbyCategory(p.type) === code);
      const fromSelected = catalog.filter(
        (p) =>
          nearbyCategory(p.type) === code &&
          !fromSearch.some((s) => s.placeId === p.placeId),
      );
      map.set(
        code,
        [...fromSearch, ...fromSelected].sort(
          (a, b) => a.distanceMeters - b.distanceMeters,
        ),
      );
    }
    return map;
  }, [suggestions, catalog]);

  const totalFound = useMemo(() => {
    const seen = new Set<string>();
    let n = 0;
    for (const places of foundByCategory.values()) {
      for (const p of places) {
        if (seen.has(p.placeId)) continue;
        seen.add(p.placeId);
        n += 1;
      }
    }
    return n;
  }, [foundByCategory]);

  const selectedByCategory = useMemo(() => {
    const map = new Map<NearbyCategory, NearbyPlace[]>();
    for (const code of CATALOG_CATEGORIES) {
      map.set(
        code,
        catalog
          .filter((p) => nearbyCategory(p.type) === code)
          .sort((a, b) => a.distanceMeters - b.distanceMeters),
      );
    }
    return map;
  }, [catalog]);

  const change = (next: NearbyPlace[]) =>
    onChange(
      latitude == null || longitude == null
        ? next
        : relocateNearby(next, latitude, longitude),
    );

  const loadAll = async () => {
    if (latitude == null || longitude == null || !searchRef.current) return;
    const request = ++seq.current;
    setLoading(true);
    setLoadError(false);
    try {
      const result = await searchRef.current(latitude, longitude);
      if (request !== seq.current) return;
      setSuggestions(
        result.filter(
          (p) => !isCustomPlace(p) && nearbyCategory(p.type) !== 'other',
        ),
      );
      setSearched(true);
      setTab('all');
      setExpanded('transit');
      setMapLocked(true);
      setPinningPlaceId(null);
    } catch {
      if (request === seq.current) setLoadError(true);
    } finally {
      if (request === seq.current) setLoading(false);
    }
  };

  const toggle = (place: NearbyPlace) => {
    if (isCustomPlace(place)) {
      setActiveId(place.placeId);
      return;
    }
    setActiveId(place.placeId);
    if (ids.includes(place.placeId)) {
      change(value.filter((p) => p.placeId !== place.placeId));
    } else if (catalog.length < MAX_SELECTED) {
      change([...value, place]);
    }
  };

  const selectAllInCategory = (places: NearbyPlace[]) => {
    const placeIds = new Set(places.map((p) => p.placeId));
    const selectedInCat = places.filter((p) => ids.includes(p.placeId));
    if (selectedInCat.length === places.length && places.length > 0) {
      change(value.filter((p) => !placeIds.has(p.placeId)));
      return;
    }
    const keep = value.filter((p) => !placeIds.has(p.placeId));
    const room = Math.max(0, MAX_SELECTED - keep.filter((p) => !isCustomPlace(p)).length);
    change([...keep, ...places.slice(0, room)]);
  };

  const expandCategory = (code: NearbyCategory | null) => {
    setExpanded(code);
    setPinningPlaceId(null);
    // Do not toggle mapLocked here — it remounts/clears native markers.
  };

  const startPinEdit = (placeId: string) => {
    if (pinningPlaceId === placeId) {
      setPinningPlaceId(null);
      setMapLocked(true);
      return;
    }
    setExpanded('other');
    setPinningPlaceId(placeId);
    setActiveId(placeId === PENDING_CUSTOM ? null : placeId);
    setMapLocked(false);
  };

  const addCustomPlace = () => {
    if (custom.length >= MAX_CUSTOM || latitude == null || longitude == null) return;
    setExpanded('other');
    setPinningPlaceId(PENDING_CUSTOM);
    setActiveId(null);
    setMapLocked(false);
  };

  const selectionState = (places: NearbyPlace[]) => {
    if (!places.length) return 'none' as const;
    const n = places.filter((p) => ids.includes(p.placeId)).length;
    if (n === 0) return 'none' as const;
    if (n === places.length) return 'all' as const;
    return 'some' as const;
  };

  const mapPlaces = useMemo(() => {
    const base = searched ? suggestions : catalog;
    const extras = value.filter((p) => !base.some((s) => s.placeId === p.placeId));
    return [...base, ...extras];
  }, [searched, suggestions, catalog, value]);

  const propertyLine = propertyName?.trim() || '';
  const propertySub = address?.trim() || cr.nearbyPropertyHint;

  if (latitude == null || longitude == null) {
    return <Text style={styles.hint}>{cr.nearbyMissingCoords}</Text>;
  }

  const renderPlaceRow = (place: NearbyPlace, code: NearbyCategory) => {
    const checked = ids.includes(place.placeId);
    return (
      <Pressable
        key={place.placeId}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={() => toggle(place)}
        style={[styles.placeRow, checked && styles.placeRowOn]}
      >
        <View
          style={[
            styles.placeIcon,
            { backgroundColor: `${categoryColors[code]}14` },
          ]}
        >
          <MobileIcon
            name={CATEGORY_ICONS[code]}
            size={18}
            color={categoryColors[code]}
          />
        </View>
        <View style={styles.placeText}>
          <Text style={styles.placeName} numberOfLines={2}>
            {formatTransitPlaceName(place.name, place.type, place.vicinity)}
          </Text>
          <Text style={styles.placeMeta}>
            {formatDistance(place.distanceMeters)}
          </Text>
        </View>
        <View style={[styles.checkbox, checked && styles.checkboxOn]}>
          {checked ? (
            <MobileIcon name="check" size={12} color={tokens.colors.white} weight="bold" />
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.body}>
      <View style={styles.propertyRow}>
        <View style={styles.propertyIcon}>
          <MobileIcon name="buildings" size={18} color={tokens.colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {propertyLine ? (
            <Text style={styles.propertyTitle} numberOfLines={1}>
              {propertyLine}
            </Text>
          ) : null}
          <Text style={styles.propertySub} numberOfLines={2}>
            {propertySub}
          </Text>
        </View>
      </View>

      <NearbyPlacesMap
        markerTitle={propertyLine || cr.propertyName}
        latitude={latitude}
        longitude={longitude}
        places={mapPlaces}
        selectedIds={ids}
        activeId={activeId}
        apiKey={apiKey}
        compact
        square
        locked={mapLocked}
        onLockedChange={setMapLocked}
        customMode={pinning}
        onFullscreenPress={() => setMapFullscreen(true)}
        onPlacePress={(place) => {
          if (isCustomPlace(place)) {
            setActiveId(place.placeId);
            return;
          }
          if (!searched || pinning) return;
          toggle(place);
        }}
        onMapPress={(lat, lng) => {
          if (!pinningPlaceId || latitude == null || longitude == null) return;
          if (pinningPlaceId === PENDING_CUSTOM) {
            if (custom.length >= MAX_CUSTOM) return;
            const place = createCustomPlace(lat, lng, latitude, longitude);
            change([...value, place]);
            setActiveId(place.placeId);
            setPinningPlaceId(null);
            setMapLocked(true);
            return;
          }
          change(
            value.map((p) =>
              p.placeId === pinningPlaceId
                ? {
                    ...p,
                    latitude: lat,
                    longitude: lng,
                    distanceMeters: distanceMeters(latitude, longitude, lat, lng),
                  }
                : p,
            ),
          );
          setActiveId(pinningPlaceId);
        }}
      />

      <Modal
        visible={mapFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        onRequestClose={() => setMapFullscreen(false)}
      >
        <View
          style={[
            styles.fullscreenRoot,
            {
              paddingTop: insets.top,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle} numberOfLines={1}>
              {propertyLine || cr.steps.nearby}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cr.nearbyExitFullscreen}
              onPress={() => setMapFullscreen(false)}
              style={styles.fullscreenClose}
              hitSlop={8}
            >
              <MobileIcon name="close" size={20} color={tokens.colors.primary} />
            </Pressable>
          </View>
          <NearbyPlacesMap
            markerTitle={propertyLine || cr.propertyName}
            latitude={latitude}
            longitude={longitude}
            places={mapPlaces}
            selectedIds={ids}
            activeId={activeId}
            apiKey={apiKey}
            fillContainer
            showFullscreenControl={false}
            onFullscreenPress={() => setMapFullscreen(false)}
            locked={mapLocked}
            onLockedChange={setMapLocked}
            customMode={pinning}
            onPlacePress={(place) => {
              if (isCustomPlace(place)) {
                setActiveId(place.placeId);
                return;
              }
              if (!searched || pinning) return;
              toggle(place);
            }}
            onMapPress={(lat, lng) => {
              if (!pinningPlaceId) return;
              if (pinningPlaceId === PENDING_CUSTOM) {
                if (custom.length >= MAX_CUSTOM) return;
                const place = createCustomPlace(lat, lng, latitude, longitude);
                change([...value, place]);
                setActiveId(place.placeId);
                setPinningPlaceId(null);
                setMapLocked(true);
                return;
              }
              change(
                value.map((p) =>
                  p.placeId === pinningPlaceId
                    ? {
                        ...p,
                        latitude: lat,
                        longitude: lng,
                        distanceMeters: distanceMeters(
                          latitude,
                          longitude,
                          lat,
                          lng,
                        ),
                      }
                    : p,
                ),
              );
              setActiveId(pinningPlaceId);
            }}
          />
        </View>
      </Modal>

      {!searched ? (
        <View style={styles.idleBody}>
          <Pressable
            accessibilityRole="button"
            disabled={loading || !search}
            onPress={() => void loadAll()}
            style={[styles.searchAllBtn, (loading || !search) && { opacity: 0.5 }]}
          >
            {loading ? (
              <ActivityIndicator color={tokens.colors.primary} />
            ) : (
              <>
                <MobileIcon name="search" size={18} color={tokens.colors.primary} />
                <Text style={styles.searchAllLabel}>{cr.searchAllNearby}</Text>
              </>
            )}
          </Pressable>
          {loadError ? (
            <Pressable onPress={() => void loadAll()} style={styles.retryBtn}>
              <Text style={styles.link}>{cr.nearbyRetry}</Text>
            </Pressable>
          ) : null}
          {!!error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : (
        <View style={styles.pickBody}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTitle}>
              {interpolate(cr.nearbyPlacesFound, { count: totalFound })}
            </Text>
            <Pressable
              onPress={() => void loadAll()}
              disabled={loading || !search}
              hitSlop={8}
            >
              {loading ? (
                <ActivityIndicator color={tokens.colors.accent} />
              ) : (
                <Text style={styles.link}>{cr.refreshNearby}</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.tabs}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'all' }}
              onPress={() => setTab('all')}
              style={[styles.tab, tab === 'all' && styles.tabOn]}
            >
              <Text style={[styles.tabText, tab === 'all' && styles.tabTextOn]}>
                {cr.nearbyTabAll}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'selected' }}
              onPress={() => {
                setTab('selected');
                setPinningPlaceId(null);
                setMapLocked(true);
                if (expanded === 'other') setExpanded(null);
              }}
              style={[styles.tab, tab === 'selected' && styles.tabOn]}
            >
              <Text style={[styles.tabText, tab === 'selected' && styles.tabTextOn]}>
                {interpolate(cr.nearbyTabSelected, { count: selectedCount })}
              </Text>
            </Pressable>
          </View>

          {loadError ? (
            <Text style={styles.error}>{cr.nearbyLoadError}</Text>
          ) : null}
          {!!error ? <Text style={styles.error}>{error}</Text> : null}

          {tab === 'all'
            ? (
              <>
                {CATALOG_CATEGORIES.map((code) => {
                const places = foundByCategory.get(code) ?? [];
                const open = expanded === code;
                const selectedInCat = places.filter((p) =>
                  ids.includes(p.placeId),
                ).length;
                const state = selectionState(places);
                return (
                  <View key={code} style={styles.section}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      onPress={() =>
                        expandCategory(open ? null : code)
                      }
                      style={styles.sectionHeader}
                    >
                      <MobileIcon
                        name={CATEGORY_ICONS[code]}
                        size={20}
                        color={categoryColors[code]}
                      />
                      <Text style={styles.sectionTitle} numberOfLines={1}>
                        {cr.nearbyCategories[code]}
                      </Text>
                      <Text style={styles.sectionMeta}>
                        {places.length ? `${selectedInCat}/${places.length}` : '—'}
                      </Text>
                      <MobileIcon
                        name={open ? 'chevron-down' : 'chevron-right'}
                        size={18}
                        color={tokens.colors.textSecondary}
                      />
                    </Pressable>

                    {open ? (
                      <View style={styles.sectionBody}>
                        {!places.length ? (
                          <Text style={styles.hint}>{cr.nearbyNoneInCategory}</Text>
                        ) : (
                          <>
                            <Pressable
                              accessibilityRole="checkbox"
                              accessibilityState={{
                                checked:
                                  state === 'all'
                                    ? true
                                    : state === 'some'
                                      ? 'mixed'
                                      : false,
                              }}
                              onPress={() => selectAllInCategory(places)}
                              style={styles.selectAllRow}
                            >
                              <Text style={styles.selectAllLabel}>
                                {cr.nearbySelectAll}
                              </Text>
                              <View
                                style={[
                                  styles.checkbox,
                                  state === 'all' && styles.checkboxOn,
                                  state === 'some' && styles.checkboxSome,
                                ]}
                              >
                                {state === 'all' ? (
                                  <MobileIcon
                                    name="check"
                                    size={12}
                                    color={tokens.colors.white}
                                    weight="bold"
                                  />
                                ) : state === 'some' ? (
                                  <View style={styles.minus} />
                                ) : null}
                              </View>
                            </Pressable>
                            {places.map((place) => renderPlaceRow(place, code))}
                          </>
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}

              <View style={styles.section}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: otherOpen }}
                  onPress={() => expandCategory(otherOpen ? null : 'other')}
                  style={styles.sectionHeader}
                >
                  <MobileIcon
                    name={CATEGORY_ICONS.other}
                    size={20}
                    color={categoryColors.other}
                  />
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    {cr.nearbyCategories.other}
                  </Text>
                  <Text style={styles.sectionMeta}>
                    {`${custom.length}/${MAX_CUSTOM}`}
                  </Text>
                  <MobileIcon
                    name={otherOpen ? 'chevron-down' : 'chevron-right'}
                    size={18}
                    color={tokens.colors.textSecondary}
                  />
                </Pressable>
                {otherOpen ? (
                  <View style={styles.sectionBody}>
                    <Text style={styles.hint}>
                      {pinningPlaceId === PENDING_CUSTOM
                        ? cr.nearbyPinningHint
                        : pinning
                          ? cr.nearbyPinningHint
                          : interpolate(cr.nearbyCustomListHint, {
                              count: custom.length,
                            })}
                    </Text>
                    {custom.map((place, index) => {
                      const editingPin = pinningPlaceId === place.placeId;
                      return (
                        <View
                          key={place.placeId}
                          style={[
                            styles.customCard,
                            editingPin && styles.customCardOn,
                          ]}
                        >
                          <MobileInput
                            label={`${cr.pinName} ${index + 1}`}
                            value={place.name}
                            maxLength={200}
                            onFocus={() => setActiveId(place.placeId)}
                            onChangeText={(name) =>
                              change(
                                value.map((p) =>
                                  p.placeId === place.placeId ? { ...p, name } : p,
                                ),
                              )
                            }
                          />
                          <Text style={styles.placeMeta}>
                            {formatDistance(place.distanceMeters)}
                          </Text>
                          <View style={styles.customActions}>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityState={{ selected: editingPin }}
                              onPress={() => startPinEdit(place.placeId)}
                              style={[
                                styles.pinActionBtn,
                                editingPin && styles.pinActionBtnOn,
                              ]}
                            >
                              <MobileIcon
                                name="map-pin"
                                size={16}
                                color={
                                  editingPin
                                    ? tokens.colors.primary
                                    : tokens.colors.textHeading
                                }
                              />
                              <Text
                                style={[
                                  styles.pinActionLabel,
                                  editingPin && styles.pinActionLabelOn,
                                ]}
                              >
                                {editingPin ? cr.nearbyDonePin : cr.nearbyEditPin}
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => {
                                if (pinningPlaceId === place.placeId) {
                                  setPinningPlaceId(null);
                                  setMapLocked(true);
                                }
                                change(
                                  value.filter((p) => p.placeId !== place.placeId),
                                );
                              }}
                              style={styles.removeActionBtn}
                            >
                              <Text style={styles.removeActionLabel}>
                                {cr.removePin}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                    {custom.length < MAX_CUSTOM ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={addCustomPlace}
                        style={styles.addManualBtn}
                      >
                        <MobileIcon name="plus" size={18} color={tokens.colors.primary} />
                        <Text style={styles.addManualLabel}>
                          {cr.nearbyAddPlaceManually}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
              </>
            )
            : selectedCount === 0 ? (
                <Text style={styles.hint}>{cr.nearbyNoneSelected}</Text>
              ) : (
                <>
                {CATALOG_CATEGORIES.map((code) => {
                  const places = selectedByCategory.get(code) ?? [];
                  if (!places.length) return null;
                  return (
                    <View key={code} style={styles.selectedGroup}>
                      <View style={styles.selectedGroupHeader}>
                        <MobileIcon
                          name={CATEGORY_ICONS[code]}
                          size={16}
                          color={categoryColors[code]}
                        />
                        <Text style={styles.selectedGroupTitle}>
                          {cr.nearbyCategories[code]}
                        </Text>
                        <Text style={styles.sectionMeta}>{places.length}</Text>
                      </View>
                      <View style={styles.selectedGroupBody}>
                        {places.map((place) => renderPlaceRow(place, code))}
                      </View>
                    </View>
                  );
                })}
                {custom.length ? (
                  <View style={styles.selectedGroup}>
                    <View style={styles.selectedGroupHeader}>
                      <MobileIcon
                        name={CATEGORY_ICONS.other}
                        size={16}
                        color={categoryColors.other}
                      />
                      <Text style={styles.selectedGroupTitle}>
                        {cr.nearbyCategories.other}
                      </Text>
                      <Text style={styles.sectionMeta}>{custom.length}</Text>
                    </View>
                    <View style={styles.selectedGroupBody}>
                      {custom.map((place) => (
                        <Pressable
                          key={place.placeId}
                          onPress={() => {
                            setTab('all');
                            setExpanded('other');
                            setActiveId(place.placeId);
                            setPinningPlaceId(null);
                            setMapLocked(true);
                          }}
                          style={[styles.placeRow, styles.placeRowOn]}
                        >
                          <View
                            style={[
                              styles.placeIcon,
                              { backgroundColor: `${categoryColors.other}14` },
                            ]}
                          >
                            <MobileIcon
                              name={CATEGORY_ICONS.other}
                              size={18}
                              color={categoryColors.other}
                            />
                          </View>
                          <View style={styles.placeText}>
                            <Text style={styles.placeName} numberOfLines={2}>
                              {place.name.trim() || cr.pinName}
                            </Text>
                            <Text style={styles.placeMeta}>
                              {formatDistance(place.distanceMeters)}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                </>
              )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  propertyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  propertyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.colors.subtle.neutralBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyTitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  propertySub: {
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
  },
  idleBody: { gap: 12 },
  searchAllBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BRAND,
    backgroundColor: tokens.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  searchAllLabel: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  retryBtn: { alignItems: 'center' },
  pickBody: { gap: 12 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  summaryTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tabOn: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  tabText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  tabTextOn: {
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  section: {
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 12,
    backgroundColor: tokens.colors.white,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  sectionMeta: {
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
    fontWeight: '600',
  },
  sectionBody: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
    paddingTop: 10,
  },
  selectedGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
  },
  selectedGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.colors.subtle.neutralBg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectedGroupTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  selectedGroupBody: {
    gap: 8,
    padding: 12,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  selectAllLabel: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  placeRowOn: {
    borderColor: BRAND,
    backgroundColor: tokens.colors.subtle.brandBg,
  },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: { flex: 1, gap: 2, minWidth: 0 },
  placeName: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  placeMeta: {
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  checkboxSome: {
    backgroundColor: BRAND,
    borderColor: BRAND,
  },
  minus: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: tokens.colors.white,
  },
  customCard: { gap: 8 },
  customCardOn: {
    borderWidth: 1,
    borderColor: BRAND,
    borderRadius: 12,
    padding: 10,
    backgroundColor: tokens.colors.subtle.brandBg,
  },
  customActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pinActionBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  pinActionBtnOn: {
    borderColor: BRAND,
    backgroundColor: tokens.colors.subtle.brandBg,
  },
  pinActionLabel: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.textHeading,
  },
  pinActionLabelOn: {
    color: tokens.colors.primary,
  },
  removeActionBtn: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeActionLabel: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.error,
  },
  addManualBtn: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addManualLabel: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  link: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: tokens.colors.accent,
  },
  hint: { fontSize: 13, lineHeight: 20, color: tokens.colors.textSecondary },
  error: { fontSize: 13, lineHeight: 20, color: tokens.colors.error },
  fullscreenRoot: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.border,
    backgroundColor: tokens.colors.white,
  },
  fullscreenTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  fullscreenClose: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
