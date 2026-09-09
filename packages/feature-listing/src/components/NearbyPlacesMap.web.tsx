import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useApiLoadingStatus,
  APILoadingStatus,
} from "@vis.gl/react-google-maps";
import { useLocale } from "@nestyk/i18n";
import { MobileButton, tokens } from "@nestyk/ui/native";
import { categoryColors, nearbyCategory, type NearbyMapProps } from "../nearby";

function MapBody({
  latitude,
  longitude,
  places,
  selectedIds,
  customMode,
  activeId,
  onMapPress,
  onPlacePress,
  readOnly,
}: NearbyMapProps) {
  const { t } = useLocale();
  const status = useApiLoadingStatus();
  const [center, setCenter] = useState({ lat: latitude, lng: longitude });
  const [zoom, setZoom] = useState(15);
  useEffect(() => {
    setCenter({ lat: latitude, lng: longitude });
  }, [latitude, longitude]);
  if (
    status === APILoadingStatus.FAILED ||
    status === APILoadingStatus.AUTH_FAILURE
  )
    return (
      <Text accessibilityRole="alert">{t.agent.createRoom.mapUnavailable}</Text>
    );
  if (status !== APILoadingStatus.LOADED) return <ActivityIndicator />;
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          height: 330,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: tokens.colors.background,
        }}
      >
        <Map
          mapId="DEMO_MAP_ID"
          center={center}
          zoom={zoom}
          onCameraChanged={(event) => {
            setCenter(event.detail.center);
            setZoom(event.detail.zoom);
          }}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          streetViewControl={false}
          mapTypeControl={false}
          clickableIcons={false}
          onClick={(event) => {
            if (!readOnly && customMode && event.detail.latLng)
              onMapPress?.(event.detail.latLng.lat, event.detail.latLng.lng);
          }}
        >
          <AdvancedMarker
            position={{ lat: latitude, lng: longitude }}
            title={t.agent.createRoom.propertyName}
            zIndex={100}
          >
            <Pin
              background="#111827"
              borderColor="#ffffff"
              glyphColor="#ffffff"
            />
          </AdvancedMarker>
          {places.map((place, index) => {
            const checked = selectedIds.includes(place.placeId);
            return (
              <AdvancedMarker
                key={place.placeId}
                position={{ lat: place.latitude, lng: place.longitude }}
                title={place.name || `${index + 1}`}
                zIndex={activeId === place.placeId ? 50 : checked ? 20 : 10}
                onClick={() => onPlacePress?.(place)}
              >
                <Pin
                  background={
                    checked
                      ? "#db2777"
                      : categoryColors[nearbyCategory(place.type)]
                  }
                  borderColor="#ffffff"
                  glyphColor="#ffffff"
                  scale={activeId === place.placeId ? 1.2 : 1}
                  glyph={customMode ? String(index + 1) : checked ? "✓" : ""}
                />
              </AdvancedMarker>
            );
          })}
        </Map>
      </View>
      <MobileButton
        variant="outline"
        onPress={() => {
          setCenter({ lat: latitude, lng: longitude });
          setZoom(15);
        }}
      >
        {t.agent.createRoom.recenterMap}
      </MobileButton>
    </View>
  );
}
export function NearbyPlacesMap(props: NearbyMapProps) {
  const { t, locale } = useLocale();
  if (!props.apiKey)
    return (
      <Text accessibilityRole="alert">{t.agent.createRoom.mapUnavailable}</Text>
    );
  return (
    <APIProvider apiKey={props.apiKey} language={locale}>
      <MapBody {...props} />
    </APIProvider>
  );
}
