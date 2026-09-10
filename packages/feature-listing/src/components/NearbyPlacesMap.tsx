import React, { useEffect, useRef } from "react";
import { Platform, View } from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useLocale } from "@nestyk/i18n";
import { MobileButton } from "@nestyk/ui/native";
import { categoryColors, nearbyCategory, type NearbyMapProps } from "../nearby";
export function NearbyPlacesMap({
  latitude,
  longitude,
  markerTitle,
  radiusKm,
  places,
  selectedIds,
  customMode,
  onPlacePress,
  onMapPress,
  readOnly,
  showRecenter = true,
}: NearbyMapProps) {
  const { t } = useLocale();
  const map = useRef<MapView>(null);
  const region = {
    latitude,
    longitude,
    latitudeDelta: radiusKm ? radiusKm * 0.025 : 0.035,
    longitudeDelta: radiusKm ? radiusKm * 0.025 : 0.035,
  };
  useEffect(() => {
    map.current?.animateToRegion(region);
  }, [latitude, longitude, radiusKm]);
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
            title={markerTitle ?? t.agent.createRoom.propertyName}
          />
          {radiusKm != null && <Circle center={{ latitude, longitude }} radius={radiusKm * 1000} strokeColor="#db2777" fillColor="rgba(219,39,119,0.10)" strokeWidth={2} />}
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
      {showRecenter && <MobileButton
        variant="outline"
        onPress={() => map.current?.animateToRegion(region)}
      >
        {t.agent.createRoom.recenterMap}
      </MobileButton>}
    </View>
  );
}
