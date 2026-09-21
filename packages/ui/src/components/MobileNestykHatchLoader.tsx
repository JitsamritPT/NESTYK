import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  StyleSheet,
  View,
  type AppStateStatus,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { tokens } from '../theme/tokens';

const AnimatedG = Animated.createAnimatedComponent(G);

const INK = tokens.colors.primary;
const BRAND = tokens.colors.brand[500];
const SHELL = '#FFF5DA';
const SHADOW = '#EAD9B0';
const STROKE = 5;

/** Idle narrative loop — matches nestyk-egg-idle-v2.svg (5.6s). */
export const NESTYK_IDLE_LOOP_MS = 5600;
/** Success hatch settle time before sparks loop — matches hatch-v2. */
export const NESTYK_HATCH_DURATION_MS = 2000;

export type NestykHatchMode = 'idle' | 'success';

export type MobileNestykHatchLoaderProps = {
  /** idle = waiting loop. success = hatch once then hold + spark loop. */
  mode?: NestykHatchMode;
  /** Display size in px (spec 80–100). */
  size?: number;
  /** Fires once when success hatch settles (not on cancel/idle). */
  onSuccessComplete?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const BIRD_BODY =
  'M126 220V131L108 123 127 114C128 82 172 82 179 113L185 159Q214 154 225 170Q237 187 222 211Q210 232 179 234L150 234Q134 234 126 220Z';
const WING = 'M175 181Q191 164 210 176Q212 195 188 205';
/** Split into two absolute paths — avoid relative `m` mid-path (can crash RN SVG). */
const FOOT_L = 'M149 235v16h-12';
const FOOT_R = 'M187 235v16h12';
const SHELL_FULL =
  'M160 60C119 60 83 126 83 185C83 232 112 256 160 256S237 232 237 185C237 126 201 60 160 60Z';
const SHELL_CAP =
  'M83 185C83 126 119 60 160 60S237 126 237 185L213 199 187 180 160 199 134 180 109 199Z';
const SHELL_BASE =
  'M83 185L109 199 134 180 160 199 187 180 213 199 237 185C237 232 208 256 160 256S83 232 83 185Z';
const CRACK = 'M84 185L109 199 134 180 160 199 187 180 213 199 236 185';
const HIGHLIGHT = 'M118 118Q128 95 143 88';
/** Idle peek mask — matches nestyk-egg-idle-v2.svg clipPath (fixed to egg, bird moves inside). */
const PEEK_CLIP =
  'M70 0H250V197L213 199 187 180 160 199 134 180 109 199 70 180Z';
const SPARK_A = 'M239 75Q242 88 254 91Q242 94 239 107Q236 94 224 91Q236 88 239 75';
const SPARK_B = 'M80 119Q82 129 92 131Q82 133 80 143Q78 133 68 131Q78 129 80 119';
const SPARK_C = 'M244 192Q246 201 254 203Q246 205 244 214Q242 205 234 203Q242 201 244 192';

function BirdMark() {
  return (
    <G>
      <Path
        d={BIRD_BODY}
        fill={BRAND}
        stroke={INK}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Circle cx={149} cy={113} r={5} fill={INK} />
      <Path
        d={WING}
        fill="none"
        stroke={INK}
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
      <Path d={FOOT_L} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d={FOOT_R} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
    </G>
  );
}

function stopAll(vals: SharedValue<number>[]) {
  vals.forEach((v) => cancelAnimation(v));
}

/**
 * NESTYK hatch loader v2 — Idle peek loop (5.6s) / Success full hatch + spark twinkle.
 * Never call plain JS helpers from useAnimatedStyle (UI worklet) — Hermes SIGABRT.
 */
export const MobileNestykHatchLoader: React.FC<MobileNestykHatchLoaderProps> = ({
  mode = 'idle',
  size = 96,
  onSuccessComplete,
  style,
  accessibilityLabel,
}) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const onSuccessRef = useRef(onSuccessComplete);
  onSuccessRef.current = onSuccessComplete;
  /** Primitive captured into worklets — no JS helper calls on UI thread. */
  const unit = size / 320;
  const clipId = `nestykPeek${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stageClipId = `nestykStage${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const rock = useSharedValue(0);
  const wholeOpacity = useSharedValue(1);
  const crackOpacity = useSharedValue(0);
  const capY = useSharedValue(0);
  const birdY = useSharedValue(140);
  const birdX = useSharedValue(0);
  const birdOpacity = useSharedValue(1);
  const baseOpacity = useSharedValue(1);
  const baseY = useSharedValue(0);
  const baseScale = useSharedValue(1);
  const capOpen = useSharedValue(0);
  const sparkA = useSharedValue(0);
  const sparkB = useSharedValue(0);
  const sparkC = useSharedValue(0);

  const allValsRef = useRef<SharedValue<number>[]>([]);
  allValsRef.current = [
    rock,
    wholeOpacity,
    crackOpacity,
    capY,
    birdY,
    birdX,
    birdOpacity,
    baseOpacity,
    baseY,
    baseScale,
    capOpen,
    sparkA,
    sparkB,
    sparkC,
  ];

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(!!enabled);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(!!enabled),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const active = next === 'active';
      setAppActive(active);
      if (!active) stopAll(allValsRef.current);
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const allVals = allValsRef.current;
    stopAll(allVals);
    let successTimer: ReturnType<typeof setTimeout> | undefined;

    if (!appActive) {
      return () => stopAll(allVals);
    }

    if (reduceMotion) {
      rock.value = 0;
      birdX.value = 0;
      capY.value = 0;
      capOpen.value = 0;
      baseY.value = 0;
      baseScale.value = 1;
      if (mode === 'success') {
        wholeOpacity.value = 0;
        crackOpacity.value = 0;
        baseOpacity.value = 0;
        birdY.value = 0;
        birdOpacity.value = 1;
        sparkA.value = 0.8;
        sparkB.value = 0.8;
        sparkC.value = 0.8;
        onSuccessRef.current?.();
      } else {
        wholeOpacity.value = 1;
        crackOpacity.value = 0;
        baseOpacity.value = 1;
        birdY.value = 140;
        birdOpacity.value = 0;
        sparkA.value = 0;
        sparkB.value = 0;
        sparkC.value = 0;
      }
      return () => stopAll(allVals);
    }

    if (mode === 'idle') {
      rock.value = 0;
      wholeOpacity.value = 1;
      crackOpacity.value = 0;
      capY.value = 0;
      capOpen.value = 0;
      birdY.value = 140;
      birdX.value = 0;
      birdOpacity.value = 1;
      baseOpacity.value = 1;
      baseY.value = 0;
      baseScale.value = 1;
      sparkA.value = 0;
      sparkB.value = 0;
      sparkC.value = 0;

      const ease = Easing.inOut(Easing.sin);

      rock.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 840 }),
          withTiming(-3, { duration: 280, easing: ease }),
          withTiming(3, { duration: 280, easing: ease }),
          withTiming(0, { duration: 392, easing: ease }),
          withTiming(0, { duration: 5600 - 1792 }),
        ),
        -1,
        false,
      );

      wholeOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1568 }),
          withTiming(0, { duration: 56 }),
          withTiming(0, { duration: 3248 }),
          withTiming(1, { duration: 280 }),
          withTiming(1, { duration: 448 }),
        ),
        -1,
        false,
      );

      crackOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 952 }),
          withTiming(1, { duration: 56 }),
          withTiming(1, { duration: 3472 }),
          withTiming(0, { duration: 448 }),
          withTiming(0, { duration: 672 }),
        ),
        -1,
        false,
      );

      capY.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1792 }),
          withTiming(0, { duration: 784 }),
          withTiming(-66, { duration: 784, easing: ease }),
          withTiming(-66, { duration: 1064 }),
          withTiming(0, { duration: 1008, easing: ease }),
          withTiming(0, { duration: 168 }),
        ),
        -1,
        false,
      );

      birdY.value = withRepeat(
        withSequence(
          withTiming(140, { duration: 1792 }),
          withTiming(140, { duration: 784 }),
          withTiming(40, { duration: 784, easing: ease }),
          withTiming(40, { duration: 1064 }),
          withTiming(140, { duration: 1008, easing: ease }),
          withTiming(140, { duration: 168 }),
        ),
        -1,
        false,
      );

      birdX.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2912 }),
          withTiming(3, { duration: 168, easing: ease }),
          withTiming(0, { duration: 280, easing: ease }),
          withTiming(-3, { duration: 168, easing: ease }),
          withTiming(0, { duration: 280, easing: ease }),
          withTiming(0, { duration: 1792 }),
        ),
        -1,
        false,
      );

      return () => stopAll(allVals);
    }

    rock.value = withTiming(0, { duration: 120 });
    birdX.value = withTiming(0, { duration: 120 });
    capY.value = withTiming(0, { duration: 120 });
    wholeOpacity.value = 1;
    crackOpacity.value = 0;
    baseOpacity.value = 1;
    baseY.value = 0;
    baseScale.value = 1;
    capOpen.value = 0;
    birdY.value = 130;
    birdOpacity.value = 0;
    sparkA.value = 0;
    sparkB.value = 0;
    sparkC.value = 0;

    const hatchEase = Easing.bezier(0.2, 0.7, 0.3, 1);

    wholeOpacity.value = withTiming(0, { duration: 800 });
    crackOpacity.value = withTiming(1, { duration: 800 });
    capOpen.value = withDelay(
      700,
      withTiming(1, { duration: 1200, easing: hatchEase }),
    );
    baseOpacity.value = withDelay(1300, withTiming(0, { duration: 800 }));
    baseY.value = withDelay(1300, withTiming(20, { duration: 800 }));
    baseScale.value = withDelay(1300, withTiming(0.9, { duration: 800 }));
    birdOpacity.value = withDelay(850, withTiming(1, { duration: 200 }));
    birdY.value = withDelay(
      850,
      withSequence(
        withTiming(-8, { duration: 800, easing: hatchEase }),
        withTiming(0, { duration: 200, easing: hatchEase }),
      ),
    );

    const twinkleEase = Easing.inOut(Easing.sin);
    const startTwinkle = (sv: SharedValue<number>, delayMs: number) => {
      sv.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1000, easing: twinkleEase }),
            withTiming(0.2, { duration: 1000, easing: twinkleEase }),
          ),
          -1,
          false,
        ),
      );
    };
    startTwinkle(sparkA, 2000);
    startTwinkle(sparkB, 2600);
    startTwinkle(sparkC, 3200);

    successTimer = setTimeout(() => onSuccessRef.current?.(), NESTYK_HATCH_DURATION_MS);

    return () => {
      if (successTimer) clearTimeout(successTimer);
      stopAll(allVals);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values stable; avoid callback identity
  }, [mode, reduceMotion, appActive]);

  const rockStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rock.value}deg` }],
  }));

  const wholeStyle = useAnimatedStyle(() => ({
    opacity: wholeOpacity.value,
  }));

  const crackStyle = useAnimatedStyle(() => ({
    opacity: crackOpacity.value,
  }));

  const capIdleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: capY.value * unit }],
  }));

  /** Bird moves in viewBox units inside a fixed ClipPath (egg opening) — not as a View. */
  const birdAnimatedProps = useAnimatedProps(() => ({
    opacity: birdOpacity.value,
    transform: [
      { translateX: birdX.value },
      { translateY: birdY.value },
    ],
  }));

  const capSuccessStyle = useAnimatedStyle(() => {
    const p = capOpen.value;
    return {
      opacity: p > 0.6 ? Math.max(0, 1 - (p - 0.6) / 0.4) : 1,
      transform: [
        { translateX: p * 42 * unit },
        { translateY: p * -78 * unit },
        { rotate: `${p * 30}deg` },
      ],
    };
  });

  const baseStyle = useAnimatedStyle(() => ({
    opacity: baseOpacity.value,
    transform: [
      { translateY: baseY.value * unit },
      { scale: baseScale.value },
    ],
  }));

  const sparkAStyle = useAnimatedStyle(() => ({
    opacity: sparkA.value,
    transform: [{ scale: 0.65 + sparkA.value * 0.35 }],
  }));
  const sparkBStyle = useAnimatedStyle(() => ({
    opacity: sparkB.value,
    transform: [{ scale: 0.65 + sparkB.value * 0.35 }],
  }));
  const sparkCStyle = useAnimatedStyle(() => ({
    opacity: sparkC.value,
    transform: [{ scale: 0.65 + sparkC.value * 0.35 }],
  }));

  const isSuccess = mode === 'success';

  return (
    <View
      style={[styles.root, { width: size, height: size }, style]}
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel || (isSuccess ? 'NESTYK hatch' : 'NESTYK loading')
      }
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.layer, rockStyle]}>
        <Svg width={size} height={size} viewBox="0 0 320 320" style={StyleSheet.absoluteFill}>
          <Ellipse cx={160} cy={266} rx={77} ry={9} fill={SHADOW} opacity={0.4} />
        </Svg>

        {/* Bird: clip fixed to egg frame; translate lives inside SVG so body never spills under shell. */}
        <View style={styles.layer} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 320 320">
            <Defs>
              <ClipPath id={clipId}>
                <Path d={PEEK_CLIP} />
              </ClipPath>
              <ClipPath id={stageClipId}>
                <Rect x={45} y={25} width={235} height={233} />
              </ClipPath>
            </Defs>
            <G clipPath={`url(#${isSuccess ? stageClipId : clipId})`}>
              <AnimatedG animatedProps={birdAnimatedProps}>
                <BirdMark />
              </AnimatedG>
            </G>
          </Svg>
        </View>

        <Animated.View
          style={[styles.layer, isSuccess ? baseStyle : undefined]}
          pointerEvents="none"
        >
          <Svg width={size} height={size} viewBox="0 0 320 320">
            <Path
              d={SHELL_BASE}
              fill={SHELL}
              stroke={INK}
              strokeWidth={STROKE}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>

        {!reduceMotion || !isSuccess ? (
          <Animated.View
            style={[styles.layer, isSuccess ? capSuccessStyle : capIdleStyle]}
            pointerEvents="none"
          >
            <Svg width={size} height={size} viewBox="0 0 320 320">
              <Path
                d={SHELL_CAP}
                fill={SHELL}
                stroke={INK}
                strokeWidth={STROKE}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Path
                d={HIGHLIGHT}
                fill="none"
                stroke={BRAND}
                strokeWidth={7}
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>
        ) : null}

        <Animated.View style={[styles.layer, wholeStyle]} pointerEvents="none">
          <Svg width={size} height={size} viewBox="0 0 320 320">
            <Path
              d={SHELL_FULL}
              fill={SHELL}
              stroke={INK}
              strokeWidth={STROKE}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Path
              d={HIGHLIGHT}
              fill="none"
              stroke={BRAND}
              strokeWidth={7}
              strokeLinecap="round"
            />
          </Svg>
          <Animated.View style={[styles.layer, crackStyle]} pointerEvents="none">
            <Svg width={size} height={size} viewBox="0 0 320 320">
              <Path
                d={CRACK}
                fill="none"
                stroke={INK}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {isSuccess ? (
        <>
          <Animated.View style={[styles.layer, sparkAStyle]} pointerEvents="none">
            <Svg width={size} height={size} viewBox="0 0 320 320">
              <Path d={SPARK_A} fill={BRAND} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.layer, sparkBStyle]} pointerEvents="none">
            <Svg width={size} height={size} viewBox="0 0 320 320">
              <Path d={SPARK_B} fill={BRAND} />
            </Svg>
          </Animated.View>
          <Animated.View style={[styles.layer, sparkCStyle]} pointerEvents="none">
            <Svg width={size} height={size} viewBox="0 0 320 320">
              <Path d={SPARK_C} fill={BRAND} />
            </Svg>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
