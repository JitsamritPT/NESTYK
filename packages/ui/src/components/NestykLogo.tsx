import React from 'react';
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

export interface NestykLogoProps {
  variant?: NestykLogoVariant;
  height?: number;
  style?: React.CSSProperties;
  alt?: string;
}

type ImageModule = string | number | { src: string; default?: string };

const SOURCE: Record<NestykLogoVariant, ImageModule> = {
  mark: brandIcon as ImageModule,
  markOnDark: brandIconWhite as ImageModule,
  markOnBrand: brandIconBlack as ImageModule,
  markSecondary: brandIconSecondary as ImageModule,
  wordmark: brandLogo as ImageModule,
  wordmarkOnDark: brandLogoWhite as ImageModule,
  wordmarkOnYellow: brandLogoOnYellow as ImageModule,
  wordmarkOnBlack: brandLogoOnBlack as ImageModule,
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

function resolveSrc(source: ImageModule): string {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') return String(source);
  if (source && typeof source === 'object') {
    return source.src || source.default || '';
  }
  return '';
}

export const NestykLogo: React.FC<NestykLogoProps> = ({
  variant = 'wordmark',
  height = 28,
  style,
  alt = 'NESTYK',
}) => {
  const width = height * ASPECT[variant];
  const src = resolveSrc(SOURCE[variant]);

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={{
        width,
        height,
        objectFit: 'contain',
        display: 'block',
        ...style,
      }}
    />
  );
};
