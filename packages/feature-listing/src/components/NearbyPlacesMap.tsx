import React, { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useLocale } from "@nestyk/i18n";
import { MobileButton } from "@nestyk/ui/native";
import { categoryColors, nearbyCategory, type NearbyMapProps } from "../nearby";
export function NearbyPlacesMap({
  latitude,
  longitude,
  places,
  selectedIds,
  customMode,
  onPlacePress,
  onMapPress,
  readOnly,
}: NearbyMapProps) {
  const { t } = useLocale();
  const map = useRef<MapView>(null);
  const region = {
    latitude,
    longitude,
    latitudeDelta: 0.035,
    longitudeDelta: 0.035,
  };
  useEffect(() => {
    map.current?.animateToRegion(region);
  }, [latitude, longitude]);
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 330, borderRadius: 14, overflow: "hidden" }}>
        <MapView
          ref={map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          style={{ flex: 1 }}
          initialRegion={region}
          onPress={(event) => {
            if (
              !readOnly &&
              customMode &&
              event.nativeEvent.action !== "marker-press"
            )
              onMapPress?.(
                event.nativeEvent.coordinate.latitude,
                event.nativeEvent.coordinate.longitude,
              );
          }}
        >
          <Marker
            coordinate={{ latitude, longitude }}
            pinColor="#111827"
            title={t.agent.createRoom.propertyName}
          />
          {places.map((place, index) => (
            <Marker
              key={place.placeId}
              coordinate={place}
              title={place.name || String(index + 1)}
              pinColor={
                selectedIds.includes(place.placeId)
                  ? "#db2777"
                  : categoryColors[nearbyCategory(place.type)]
              }
              onPress={(event) => {
                event.stopPropagation();
                onPlacePress?.(place);
              }}
            />
          ))}
        </MapView>
      </View>
      <MobileButton
        variant="outline"
        onPress={() => map.current?.animateToRegion(region)}
      >
        {t.agent.createRoom.recenterMap}
      </MobileButton>
    </View>
  );
}
