import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

export type PropertyPlaceMapProps = {
  latitude: number;
  longitude: number;
};

export const PropertyPlaceMap: React.FC<PropertyPlaceMapProps> = ({
  latitude,
  longitude,
}) => {
  return (
    <View style={styles.wrap}>
      <MapView
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={{
          latitude,
          longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        scrollEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        zoomEnabled
        pointerEvents="none"
      >
        <Marker coordinate={{ latitude, longitude }} />
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
