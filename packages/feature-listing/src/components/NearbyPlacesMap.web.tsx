/// <reference types="google.maps" />
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  useApiLoadingStatus,
  useMap,
  APILoadingStatus,
} from "@vis.gl/react-google-maps";
import { useLocale } from "@nestyk/i18n";
import { MobileButton, tokens } from "@nestyk/ui/native";
import { categoryColors, nearbyCategory, type NearbyMapProps } from "../nearby";

function RadiusCircle({ latitude, longitude, radiusKm }: { latitude: number; longitude: number; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const circle = new google.maps.Circle({ map, center: { lat: latitude, lng: longitude }, radius: radiusKm * 1000, strokeColor: '#db2777', strokeWeight: 2, fillColor: '#db2777', fillOpacity: 0.1, clickable: false });
    return () => circle.setMap(null);
  }, [map, latitude, longitude, radiusKm]);
  return null;
}

function MapBody({
  latitude,
  longitude,
  markerTitle,
  radiusKm,
  places,
  selectedIds,
  customMode,
  activeId,
  onMapPress,
  onPlacePress,
  readOnly,
  showRecenter = true,
}: NearbyMapProps) {
  const { t } = useLocale();
  const status = useApiLoadingStatus();
  const [center, setCenter] = useState({ lat: latitude, lng: longitude });
  const [zoom, setZoom] = useState(radiusKm ? (radiusKm === 1 ? 14 : 12) : 15);
  useEffect(() => {
    setCenter({ lat: latitude, lng: longitude });
  }, [latitude, longitude]);
  useEffect(() => {
    if (radiusKm != null) setZoom(radiusKm === 1 ? 14 : 12);
  }, [radiusKm]);
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
            title={markerTitle ?? t.agent.createRoom.propertyName}
            zIndex={100}
          >
            <Pin
              background="#111827"
              borderColor="#ffffff"
              glyphColor="#ffffff"
            />
          </AdvancedMarker>
          {radiusKm != null && <RadiusCircle latitude={latitude} longitude={longitude} radiusKm={radiusKm} />}
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
      {showRecenter && <MobileButton
        variant="outline"
        onPress={() => {
          setCenter({ lat: latitude, lng: longitude });
          setZoom(radiusKm ? (radiusKm === 1 ? 14 : 12) : 15);
        }}
      >
        {t.agent.createRoom.recenterMap}
      </MobileButton>}
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
