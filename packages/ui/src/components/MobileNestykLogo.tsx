import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { brandIcon, brandLogo, brandLogoWhite, NestykLogoVariant } from '../assets/brandAssets';

export interface MobileNestykLogoProps {
  variant?: NestykLogoVariant;
  height?: number;
  style?: StyleProp<ImageStyle>;
}

const SOURCE: Record<NestykLogoVariant, ImageSourcePropType> = {
  mark: brandIcon as ImageSourcePropType,
  wordmark: brandLogo as ImageSourcePropType,
  wordmarkOnDark: brandLogoWhite as ImageSourcePropType,
};

/** Aspect roughly: mark 1:1 · wordmark ~3:1 */
const ASPECT: Record<NestykLogoVariant, number> = {
  mark: 1,
  wordmark: 393 / 131,
  wordmarkOnDark: 497 / 171,
};

export const MobileNestykLogo: React.FC<MobileNestykLogoProps> = ({
  variant = 'wordmark',
  height = 28,
  style,
}) => {
  const width = height * ASPECT[variant];
  return (
    <Image
      source={SOURCE[variant]}
      style={[{ width, height, resizeMode: 'contain' }, style]}
      accessibilityRole="image"
      accessibilityLabel="NESTYK"
    />
  );
};
