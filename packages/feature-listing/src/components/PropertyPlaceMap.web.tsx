import React, { createElement } from 'react';
import { StyleSheet, View } from 'react-native';

export type PropertyPlaceMapProps = {
  latitude: number;
  longitude: number;
};

export const PropertyPlaceMap: React.FC<PropertyPlaceMapProps> = ({
  latitude,
  longitude,
}) => {
  const src = `https://www.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`;
  return (
    <View style={styles.wrap}>
      {createElement('iframe', {
        src,
        style: { width: '100%', height: '100%', border: 0 },
        loading: 'lazy',
        referrerPolicy: 'no-referrer-when-downgrade',
        title: 'Google Map',
      })}
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
});
