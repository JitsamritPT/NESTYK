import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocale } from "@nestyk/i18n";
import { MobileButton, MobileInput, tokens } from "@nestyk/ui/native";
import { NearbyPlacesMap } from "./NearbyPlacesMap";
import {
  nearbyCategories,
  nearbyCategory,
  createCustomPlace,
  isCustomPlace,
  relocateNearby,
  type NearbyCategory,
  type NearbyPlace,
} from "../nearby";

export type NearbySearch = (
  latitude: number,
  longitude: number,
) => Promise<NearbyPlace[]>;
export function RoomNearbyEditor({
  latitude,
  longitude,
  value,
  onChange,
  search,
  apiKey,
  color,
  error,
}: {
  latitude: number | null;
  longitude: number | null;
  value: NearbyPlace[];
  onChange: (places: NearbyPlace[]) => void;
  search?: NearbySearch;
  apiKey?: string;
  color: string;
  error?: string;
}) {
  const { t } = useLocale();
  const cr = t.agent.createRoom;
  const [category, setCategory] = useState<NearbyCategory>("transit");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);
  const searchRef = useRef(search);
  searchRef.current = search;
  useEffect(() => {
    seq.current++;
    setSuggestions([]);
    setLoaded(false);
    setLoadError(false);
    setLoading(false);
    return () => {
      seq.current++;
    };
  }, [latitude, longitude]);
  const load = async () => {
    if (latitude == null || longitude == null || !searchRef.current) return;
    const request = ++seq.current;
    setLoading(true);
    setLoadError(false);
    try {
      const result = await searchRef.current(latitude, longitude);
      if (request !== seq.current) return;
      setSuggestions(result);
      setLoaded(true);
    } catch {
      if (request === seq.current) setLoadError(true);
    } finally {
      if (request === seq.current) setLoading(false);
    }
  };
  const custom = value.filter(isCustomPlace);
  const ids = value.map((p) => p.placeId);
  const combined = [
    ...suggestions,
    ...value.filter((p) => !suggestions.some((s) => s.placeId === p.placeId)),
  ];
  const visible =
    category === "other"
      ? custom
      : combined.filter(
          (p) => !isCustomPlace(p) && nearbyCategory(p.type) === category,
        );
  const change = (next: NearbyPlace[]) =>
    onChange(
      latitude == null || longitude == null
        ? next
        : relocateNearby(next, latitude, longitude),
    );
  const toggle = (place: NearbyPlace) => {
    setActiveId(place.placeId);
    if (isCustomPlace(place)) return;
    if (ids.includes(place.placeId))
      change(value.filter((p) => p.placeId !== place.placeId));
    else if (value.length - custom.length < 24) change([...value, place]);
  };
  if (latitude == null || longitude == null)
    return <Text style={styles.hint}>{cr.nearbyMissingCoords}</Text>;
  return (
    <View style={styles.body}>
      <Text style={styles.hint}>{cr.nearbyMapHint}</Text>
      <View style={styles.tabs}>
        {nearbyCategories.map((code) => (
          <Pressable
            key={code}
            accessibilityRole="tab"
            accessibilityState={{ selected: category === code }}
            onPress={() => setCategory(code)}
            style={[
              styles.tab,
              category === code && {
                borderColor: color,
                backgroundColor: `${color}0D`,
              },
            ]}
          >
            <Text style={[styles.label, category === code && { color }]}>
              {cr.nearbyCategories[code]} ·{" "}
              {
                value.filter((p) =>
                  code === "other"
                    ? isCustomPlace(p)
                    : !isCustomPlace(p) && nearbyCategory(p.type) === code,
                ).length
              }
            </Text>
          </Pressable>
        ))}
      </View>
      <NearbyPlacesMap
        latitude={latitude}
        longitude={longitude}
        places={visible}
        selectedIds={ids}
        activeId={activeId}
        apiKey={apiKey}
        customMode={category === "other"}
        onPlacePress={toggle}
        onMapPress={(lat, lng) => {
          if (custom.length >= 5) return;
          const place = createCustomPlace(lat, lng, latitude, longitude);
          setActiveId(place.placeId);
          change([...value, place]);
        }}
      />
      <Text style={styles.hint}>
        {category === "other"
          ? cr.customPinHint.replace("{count}", String(custom.length))
          : cr.nearbySelectHint}
      </Text>
      {category !== "other" && (
        <MobileButton
          variant="outline"
          onPress={load}
          disabled={loading || !search}
          isLoading={loading}
        >
          {loaded ? cr.refreshNearby : cr.searchNearby}
        </MobileButton>
      )}
      {loading && <ActivityIndicator color={color} />}
      {loadError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {cr.nearbyLoadError}
        </Text>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {category !== "other" && loaded && !loading && !visible.length && (
        <Text style={styles.hint}>{cr.nearbyEmpty}</Text>
      )}
      {visible.map((place, index) =>
        category === "other" ? (
          <View
            key={place.placeId}
            style={[
              styles.place,
              activeId === place.placeId && { borderColor: color },
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
            <Text style={styles.hint}>
              {cr.distanceStraight.replace(
                "{meters}",
                place.distanceMeters.toLocaleString(),
              )}
            </Text>
            <MobileButton
              variant="outline"
              onPress={() =>
                change(value.filter((p) => p.placeId !== place.placeId))
              }
            >
              {cr.removePin}
            </MobileButton>
          </View>
        ) : (
          <Pressable
            key={place.placeId}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ids.includes(place.placeId) }}
            onPress={() => toggle(place)}
            style={[
              styles.place,
              ids.includes(place.placeId) && {
                borderColor: color,
                backgroundColor: `${color}0D`,
              },
            ]}
          >
            <Text style={styles.label}>
              {ids.includes(place.placeId) ? "✓ " : "+ "}
              {place.name}
            </Text>
            <Text style={styles.hint}>
              {cr.distanceStraight.replace(
                "{meters}",
                place.distanceMeters.toLocaleString(),
              )}
            </Text>
          </Pressable>
        ),
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  body: { gap: 12 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tab: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  label: { fontSize: 14, lineHeight: 21, color: tokens.colors.textHeading },
  hint: { fontSize: 13, lineHeight: 20, color: tokens.colors.textSecondary },
  place: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    gap: 8,
  },
  error: { fontSize: 13, lineHeight: 20, color: tokens.colors.error },
});
