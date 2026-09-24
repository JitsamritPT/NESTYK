import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TRACK = '#EEF2F6';
const LOW = tokens.colors.error;
const MID = tokens.colors.brand[500];
const HIGH = tokens.colors.success;

/** Score bands: 0–49 low (red) · 50–74 mid (yellow) · 75–100 high (green). */
export function scoreRingColor(score: number): string {
  'worklet';
  if (score >= 75) return HIGH;
  if (score >= 50) return MID;
  return LOW;
}

export interface MobileScoreRingProps {
  /** 0–100. `null` renders an empty grey ring with a dash. */
  value: number | null;
  size?: number;
  strokeWidth?: number;
  /** Caption under the ring (e.g. "Match"). */
  label?: string;
  accessibilityLabel?: string;
}

export function MobileScoreRing({
  value,
  size = 52,
  strokeWidth = 5,
  label,
  accessibilityLabel,
}: MobileScoreRingProps) {
  const { theme } = useMobileTheme();
  const target = value == null ? 0 : Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [target, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
    stroke: scoreRingColor(progress.value),
  }));

  const center = size / 2;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={value == null ? undefined : { min: 0, max: 100, now: target }}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={TRACK}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {value != null ? (
            <AnimatedCircle
              cx={center}
              cy={center}
              r={radius}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
              animatedProps={animatedProps}
            />
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Text
            style={[
              styles.value,
              { color: value == null ? tokens.colors.divider : theme.textHeading },
            ]}
            numberOfLines={1}
          >
            {value == null ? '—' : target}
            {value == null ? null : <Text style={styles.percent}>%</Text>}
          </Text>
        </View>
      </View>
      {label ? (
        <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 2,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: tokens.typography.native.bodyBold,
    fontSize: 14,
    lineHeight: 20,
  },
  percent: {
    fontSize: 9,
    lineHeight: 14,
  },
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 10,
    lineHeight: 15,
    maxWidth: 64,
  },
});
