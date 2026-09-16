import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { brandIcon } from '../assets/brandAssets';
import { useLocale } from '@nestyk/i18n';
import {
  MobileSmileProgress,
  SmileProgressMetrics,
  SmileProgressSize,
} from './MobileSmileProgress';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export interface MobileBrandLoaderProps {
  /** Optional caption under the smile. Defaults to `common.loading`. */
  label?: string;
  size?: SmileProgressSize;
  /**
   * When false, smile stages while waiting. When true, fills to 100% then calls `onComplete`.
   */
  done?: boolean;
  /** Fires once the smile has animated to full after `done`. */
  onComplete?: () => void;
  /** Show brand mark icon above smile (default true for md/lg). */
  showIcon?: boolean;
  /**
   * Stretch to a shared viewport height and vertically center —
   * keeps loader at the same spot across list screens inside ModePage scroll.
   */
  fill?: boolean;
}

/** Icon diameter ≈ smile height; smile width ~2.5× icon for a balanced stack. */
const LOADER_LAYOUT: Record<
  SmileProgressSize,
  { icon: number; smile: SmileProgressMetrics }
> = {
  sm: { icon: 52, smile: { width: 112, height: 42, stroke: 6.5, glow: 11 } },
  md: { icon: 68, smile: { width: 132, height: 50, stroke: 7.5, glow: 12 } },
  lg: { icon: 80, smile: { width: 160, height: 61, stroke: 9, glow: 14 } },
};

/** Approx. ModePage header + tab bar + safe padding — keep loader Y aligned across tabs. */
const SHELL_CHROME_OFFSET = 240;
const BRAND = tokens.colors.brand[500];
const RING_COUNT = 3;
const RING_DURATION = 1800;
const RING_STAGGER = 600;

function RippleRing({
  diameter,
  delayMs,
}: {
  diameter: number;
  delayMs: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delayMs,
      withRepeat(
        withTiming(1, { duration: RING_DURATION, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
  }, [delayMs, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 0.85 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderColor: BRAND,
        },
        style,
      ]}
    />
  );
}

/**
 * In-page branded loader — smile arc from preload, without full-screen backdrop.
 * Keep shell (header / tabs) visible; swap for ActivityIndicator on list first-load.
 */
export const MobileBrandLoader: React.FC<MobileBrandLoaderProps> = ({
  label,
  size = 'md',
  done = false,
  onComplete,
  showIcon,
  fill = false,
}) => {
  const { theme } = useMobileTheme();
  const { t } = useLocale();
  const { height } = useWindowDimensions();
  const withIcon = showIcon ?? size !== 'sm';
  const caption = label ?? t.common.loading;
  const [progress, setProgress] = useState(0.18);
  const gradientId = useRef(`brandLoaderGlow_${Math.random().toString(36).slice(2, 9)}`).current;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const layout = LOADER_LAYOUT[size];
  const iconDiameter = layout.icon;
  const radius = iconDiameter / 2;
  const haloSize = Math.round(iconDiameter * 1.9);
  const idle = useSharedValue(1);

  useEffect(() => {
    idle.value = 1;
    idle.value = withRepeat(
      withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [idle]);

  const iconIdleStyle = useAnimatedStyle(() => ({
    opacity: 2.08 - idle.value,
    transform: [{ scale: idle.value }],
  }));

  useEffect(() => {
    if (done) {
      setProgress(1);
      return;
    }
    setProgress(0.22);
    const t1 = setTimeout(() => setProgress(0.48), 280);
    const t2 = setTimeout(() => setProgress(0.72), 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [done]);

  const handleFilled = useCallback(() => {
    onCompleteRef.current?.();
  }, []);

  return (
    <View
      style={[
        styles.root,
        fill && styles.fill,
        fill && { minHeight: Math.max(320, height - SHELL_CHROME_OFFSET) },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={caption}
      accessibilityLiveRegion="polite"
    >
      {withIcon ? (
        <View style={[styles.iconStage, { width: haloSize, height: haloSize }]}>
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <RippleRing
              key={index}
              diameter={iconDiameter}
              delayMs={index * RING_STAGGER}
            />
          ))}
          <Animated.View
            style={[
              styles.iconCircle,
              {
                width: iconDiameter,
                height: iconDiameter,
                borderRadius: radius,
              },
              iconIdleStyle,
            ]}
          >
            <Image
              source={brandIcon as ImageSourcePropType}
              style={{
                width: iconDiameter,
                height: iconDiameter,
                borderRadius: radius,
              }}
              resizeMode="cover"
              accessibilityRole="image"
              accessibilityLabel="NESTYK"
            />
          </Animated.View>
        </View>
      ) : null}
      <MobileSmileProgress
        progress={progress}
        size={size}
        metrics={layout.smile}
        gradientId={`brandLoaderGlow_${gradientId}`}
        onFilled={done ? handleFilled : undefined}
      />
      <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={2}>
        {caption}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  fill: {
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 0,
  },
  iconStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  iconCircle: {
    overflow: 'hidden',
    zIndex: 1,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 240,
    marginTop: 4,
  },
});
