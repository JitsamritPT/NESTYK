import React from 'react';
import { brandIcon, brandLogo, brandLogoWhite, NestykLogoVariant } from '../assets/brandAssets';

export interface NestykLogoProps {
  variant?: NestykLogoVariant;
  height?: number;
  style?: React.CSSProperties;
  alt?: string;
}

type ImageModule = string | number | { src: string; default?: string };

const SOURCE: Record<NestykLogoVariant, ImageModule> = {
  mark: brandIcon as ImageModule,
  wordmark: brandLogo as ImageModule,
  wordmarkOnDark: brandLogoWhite as ImageModule,
};

const ASPECT: Record<NestykLogoVariant, number> = {
  mark: 1,
  wordmark: 393 / 131,
  wordmarkOnDark: 497 / 171,
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
