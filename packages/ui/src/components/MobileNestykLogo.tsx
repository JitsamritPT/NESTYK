import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import {
  brandIcon,
  brandIconBlack,
  brandIconSecondary,
  brandIconWhite,
  brandLogo,
  brandLogoOnBlack,
  brandLogoOnYellow,
  brandLogoWhite,
  NESTYK_MARK_ASPECT,
  NESTYK_WORDMARK_ASPECT,
  NestykLogoVariant,
} from '../assets/brandAssets';

export interface MobileNestykLogoProps {
  variant?: NestykLogoVariant;
  height?: number;
  style?: StyleProp<ImageStyle>;
}

const SOURCE: Record<NestykLogoVariant, ImageSourcePropType> = {
  mark: brandIcon as ImageSourcePropType,
  markOnDark: brandIconWhite as ImageSourcePropType,
  markOnBrand: brandIconBlack as ImageSourcePropType,
  markSecondary: brandIconSecondary as ImageSourcePropType,
  wordmark: brandLogo as ImageSourcePropType,
  wordmarkOnDark: brandLogoWhite as ImageSourcePropType,
  wordmarkOnYellow: brandLogoOnYellow as ImageSourcePropType,
  wordmarkOnBlack: brandLogoOnBlack as ImageSourcePropType,
};

const ASPECT: Record<NestykLogoVariant, number> = {
  mark: NESTYK_MARK_ASPECT,
  markOnDark: NESTYK_MARK_ASPECT,
  markOnBrand: NESTYK_MARK_ASPECT,
  markSecondary: NESTYK_MARK_ASPECT,
  wordmark: NESTYK_WORDMARK_ASPECT,
  wordmarkOnDark: NESTYK_WORDMARK_ASPECT,
  wordmarkOnYellow: NESTYK_WORDMARK_ASPECT,
  wordmarkOnBlack: NESTYK_WORDMARK_ASPECT,
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
