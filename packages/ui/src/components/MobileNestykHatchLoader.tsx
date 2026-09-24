import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  Image,
  type ImageSourcePropType,
  StyleSheet,
  View,
  type AppStateStatus,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  type SharedValue,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { hatchHead, hatchSuccess } from '../assets/hatchAssets';

/** Idle narrative loop — matches nestyk-egg-idle-v2.svg (6.2s). */
export const NESTYK_IDLE_LOOP_MS = 6200;
/** Success hatch settle before spark loop. */
export const NESTYK_HATCH_DURATION_MS = 2000;

export type NestykHatchMode = 'idle' | 'success';

export type MobileNestykHatchLoaderProps = {
  mode?: NestykHatchMode;
  size?: number;
  onSuccessComplete?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

function stopAll(vals: SharedValue<number>[]) {
  vals.forEach((v) => cancelAnimation(v));
}

function eggFillDefs(prefix: string) {
  return (
    <Defs>
      <LinearGradient id={`${prefix}Fill`} x1="0.2" y1="0" x2="0.78" y2="1">
        <Stop offset="0" stopColor="#FFFDF7" />
        <Stop offset="0.48" stopColor="#FFF8E8" />
        <Stop offset="1" stopColor="#DDC9A3" />
      </LinearGradient>
      <RadialGradient id={`${prefix}Light`} cx="31%" cy="22%" r="70%">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
        <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
      </RadialGradient>
    </Defs>
  );
}

/** Lower shell — stays put while the cap lifts. */
function EggBase({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 320 320">
      {eggFillDefs('nestykBase')}
      <Path
        d="M82 185 107 200 133 180 160 200 187 180 214 200 238 185C238 233 209 259 160 259S82 233 82 185Z"
        fill="url(#nestykBaseFill)"
      />
      <Path
        d="M82 185 107 200 133 180 160 200 187 180 214 200 238 185C238 233 209 259 160 259S82 233 82 185Z"
        fill="url(#nestykBaseLight)"
        opacity={0.62}
      />
      <Path
        d="M103 221Q130 247 175 245"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={7}
        strokeLinecap="round"
        opacity={0.3}
      />
    </Svg>
  );
}

/** Upper shell — lifts slightly so the head peeks from behind. */
function EggCap({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 320 320">
      {eggFillDefs('nestykCap')}
      <Path
        d="M82 185C82 120 118 49 160 49S238 120 238 185L214 200 187 180 160 200 133 180 107 200Z"
        fill="url(#nestykCapFill)"
      />
      <Path
        d="M82 185C82 120 118 49 160 49S238 120 238 185L214 200 187 180 160 200 133 180 107 200Z"
        fill="url(#nestykCapLight)"
      />
      <Path
        d="M105 120Q121 79 151 67"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.52}
      />
    </Svg>
  );
}

/**
 * Honey & Cream 2.5D hatch loader.
 * Idle 6.2s: rock → crack → cap lifts → head peeks → hide → close.
 * Success: continue from open state (no full-egg snap) → success PNG + sparks.
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
  const unit = size / 320;

  const eggRotate = useSharedValue(0);
  const shellOpacity = useSharedValue(1);
  const crackOpacity = useSharedValue(0);
  const capY = useSharedValue(0);
  const capRotate = useSharedValue(0);
  const headOpacity = useSharedValue(0);
  const headY = useSharedValue(18);
  const headScale = useSharedValue(0.98);
  const headRotate = useSharedValue(0);
  const successOpacity = useSharedValue(0);
  const successY = useSharedValue(24);
  const successScale = useSharedValue(0.9);
  const shadowScale = useSharedValue(1);
  const sparkA = useSharedValue(0);
  const sparkB = useSharedValue(0);
  const sparkC = useSharedValue(0);

  const allValsRef = useRef<SharedValue<number>[]>([]);
  allValsRef.current = [
    eggRotate,
    shellOpacity,
    crackOpacity,
    capY,
    capRotate,
    headOpacity,
    headY,
    headScale,
    headRotate,
    successOpacity,
    successY,
    successScale,
    shadowScale,
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
    const vals = allValsRef.current;
    stopAll(vals);
    let successTimer: ReturnType<typeof setTimeout> | undefined;
    const ease = Easing.inOut(Easing.sin);
    const soft = Easing.bezier(0.28, 0.72, 0.28, 1);
    const capEase = Easing.bezier(0.38, 0.05, 0.2, 1);

    if (!appActive) {
      return () => stopAll(vals);
    }

    if (reduceMotion) {
      eggRotate.value = 0;
      capY.value = 0;
      capRotate.value = 0;
      headY.value = 0;
      headScale.value = 1;
      headRotate.value = 0;
      successY.value = 0;
      successScale.value = 1;
      shadowScale.value = 1;
      sparkA.value = 0;
      sparkB.value = 0;
      sparkC.value = 0;
      if (mode === 'success') {
        shellOpacity.value = 0;
        crackOpacity.value = 0;
        headOpacity.value = 0;
        successOpacity.value = 1;
        sparkA.value = 0.75;
        onSuccessRef.current?.();
      } else {
        shellOpacity.value = 1;
        crackOpacity.value = 0;
        headOpacity.value = 0;
        successOpacity.value = 0;
      }
      return () => stopAll(vals);
    }

    if (mode === 'idle') {
      successOpacity.value = 0;
      successY.value = 24;
      successScale.value = 0.9;
      sparkA.value = 0;
      sparkB.value = 0;
      sparkC.value = 0;

      shellOpacity.value = 1;
      eggRotate.value = 0;
      crackOpacity.value = 0;
      capY.value = 0;
      capRotate.value = 0;
      headOpacity.value = 0;
      headY.value = 18;
      headScale.value = 0.98;
      headRotate.value = 0;
      shadowScale.value = 1;

      // 6.2s story from nestyk-egg-idle-v2.svg
      eggRotate.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 868 }),
          withTiming(-1.8, { duration: 248, easing: ease }),
          withTiming(1.8, { duration: 248, easing: ease }),
          withTiming(-0.7, { duration: 248, easing: ease }),
          withTiming(0, { duration: 248, easing: ease }),
          withTiming(0, { duration: 4340 }),
        ),
        -1,
        false,
      );

      crackOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1302 }),
          withTiming(0.58, { duration: 186, easing: ease }),
          withTiming(0.58, { duration: 2790 }),
          withTiming(0, { duration: 372, easing: ease }),
          withTiming(0, { duration: 1550 }),
        ),
        -1,
        false,
      );

      capY.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1922 }),
          withTiming(-22, { duration: 620, easing: capEase }),
          withTiming(-29, { duration: 434, easing: capEase }),
          withTiming(-29, { duration: 930 }),
          withTiming(-20, { duration: 434, easing: soft }),
          withTiming(0, { duration: 558, easing: soft }),
          withTiming(0, { duration: 1302 }),
        ),
        -1,
        false,
      );

      capRotate.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 1922 }),
          withTiming(-1, { duration: 620, easing: capEase }),
          withTiming(-2, { duration: 434, easing: capEase }),
          withTiming(-2, { duration: 930 }),
          withTiming(-0.7, { duration: 434, easing: soft }),
          withTiming(0, { duration: 558, easing: soft }),
          withTiming(0, { duration: 1302 }),
        ),
        -1,
        false,
      );

      // Head peeks after crack; hides (opacity→0, y↓) before cap fully closes
      headOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2108 }),
          withTiming(0.35, { duration: 434, easing: soft }),
          withTiming(1, { duration: 434, easing: soft }),
          withTiming(1, { duration: 930 }),
          withTiming(0.7, { duration: 310, easing: soft }),
          withTiming(0, { duration: 310, easing: soft }),
          withTiming(0, { duration: 1674 }),
        ),
        -1,
        false,
      );

      headY.value = withRepeat(
        withSequence(
          withTiming(18, { duration: 2108 }),
          withTiming(10, { duration: 434, easing: soft }),
          withTiming(0, { duration: 434, easing: soft }),
          withTiming(-1, { duration: 310, easing: ease }),
          withTiming(0, { duration: 310, easing: ease }),
          withTiming(0, { duration: 310 }),
          withTiming(9, { duration: 310, easing: soft }),
          withTiming(18, { duration: 310, easing: soft }),
          withTiming(18, { duration: 1674 }),
        ),
        -1,
        false,
      );

      headScale.value = withRepeat(
        withSequence(
          withTiming(0.98, { duration: 2108 }),
          withTiming(1, { duration: 868, easing: soft }),
          withTiming(1, { duration: 930 }),
          withTiming(0.99, { duration: 620, easing: soft }),
          withTiming(0.98, { duration: 1674 }),
        ),
        -1,
        false,
      );

      headRotate.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2976 }),
          withTiming(0.7, { duration: 310, easing: ease }),
          withTiming(-0.7, { duration: 310, easing: ease }),
          withTiming(0, { duration: 310, easing: ease }),
          withTiming(0, { duration: 2294 }),
        ),
        -1,
        false,
      );

      shadowScale.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1922 }),
          withTiming(0.9, { duration: 1054, easing: ease }),
          withTiming(0.9, { duration: 930 }),
          withTiming(1, { duration: 744, easing: ease }),
          withTiming(1, { duration: 1550 }),
        ),
        -1,
        false,
      );

      return () => stopAll(vals);
    }

    // Success — continue from current open state; never snap shellOpacity back to a full sealed egg.
    const hatchEase = Easing.bezier(0.18, 0.8, 0.28, 1);

    eggRotate.value = withTiming(0, { duration: 220, easing: ease });
    headOpacity.value = withTiming(0, { duration: 180, easing: soft });
    headY.value = withTiming(14, { duration: 220, easing: soft });
    headScale.value = withTiming(0.98, { duration: 180 });
    headRotate.value = withTiming(0, { duration: 180 });

    crackOpacity.value = withTiming(0.55, { duration: 200 });
    // Keep cap open (or lift a touch more) while shells fade — no closed-egg beat.
    capY.value = withTiming(-32, { duration: 420, easing: soft });
    capRotate.value = withTiming(-2.5, { duration: 420, easing: soft });
    shellOpacity.value = withDelay(280, withTiming(0, { duration: 420, easing: ease }));
    crackOpacity.value = withDelay(280, withTiming(0, { duration: 360, easing: ease }));

    successOpacity.value = 0;
    successY.value = 22;
    successScale.value = 0.9;
    sparkA.value = 0;
    sparkB.value = 0;
    sparkC.value = 0;

    successOpacity.value = withDelay(360, withTiming(1, { duration: 280 }));
    successY.value = withDelay(
      360,
      withSequence(
        withTiming(-4, { duration: 560, easing: hatchEase }),
        withTiming(0, { duration: 240, easing: ease }),
      ),
    );
    successScale.value = withDelay(
      360,
      withSequence(
        withTiming(1.03, { duration: 560, easing: hatchEase }),
        withTiming(1, { duration: 240, easing: ease }),
      ),
    );
    shadowScale.value = withDelay(
      360,
      withSequence(
        withTiming(0.88, { duration: 320, easing: ease }),
        withTiming(1.06, { duration: 240, easing: ease }),
        withTiming(1, { duration: 200, easing: ease }),
      ),
    );

    const twinkle = (sv: SharedValue<number>, delayMs: number) => {
      sv.value = withDelay(
        delayMs,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 900, easing: ease }),
            withTiming(0.18, { duration: 900, easing: ease }),
          ),
          -1,
          false,
        ),
      );
    };
    twinkle(sparkA, 1600);
    twinkle(sparkB, 2100);
    twinkle(sparkC, 2600);

    successTimer = setTimeout(() => onSuccessRef.current?.(), NESTYK_HATCH_DURATION_MS);

    return () => {
      if (successTimer) clearTimeout(successTimer);
      stopAll(vals);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reduceMotion, appActive]);

  const rockStyle = useAnimatedStyle(() => ({
    opacity: shellOpacity.value,
    transform: [{ rotate: `${eggRotate.value}deg` }],
  }));

  const capStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: capY.value * unit },
      { rotate: `${capRotate.value}deg` },
    ],
  }));

  const crackStyle = useAnimatedStyle(() => ({
    opacity: crackOpacity.value,
  }));

  const headStyle = useAnimatedStyle(() => ({
    opacity: headOpacity.value * shellOpacity.value,
    transform: [
      { translateY: headY.value * unit },
      { scale: headScale.value },
      { rotate: `${headRotate.value}deg` },
    ],
  }));

  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [{ translateY: successY.value }, { scale: successScale.value }],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.14,
    transform: [{ scaleX: shadowScale.value }],
  }));

  const sparkAStyle = useAnimatedStyle(() => ({
    opacity: sparkA.value,
    transform: [{ scale: 0.65 + sparkA.value * 0.4 }],
  }));
  const sparkBStyle = useAnimatedStyle(() => ({
    opacity: sparkB.value,
    transform: [{ scale: 0.65 + sparkB.value * 0.4 }],
  }));
  const sparkCStyle = useAnimatedStyle(() => ({
    opacity: sparkC.value,
    transform: [{ scale: 0.65 + sparkC.value * 0.4 }],
  }));

  const isSuccess = mode === 'success';
  const imgH = Math.round(size * (338 / 384));
  const imgTop = Math.round(size * 0.04);
  const headWidth = Math.round(size * 0.55);
  const headHeight = Math.round(headWidth * (338 / 384));

  return (
    <View
      style={[styles.root, { width: size, height: size }, style]}
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ||
        (isSuccess
          ? 'NESTYK Honey and Cream hatched successfully'
          : 'NESTYK Honey and Cream waiting in egg')
      }
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.shadow, shadowStyle]} pointerEvents="none">
        <Svg width={size} height={size} viewBox="0 0 320 320">
          <Ellipse cx={160} cy={270} rx={66} ry={9} fill="#5B381C" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.layer, rockStyle]} pointerEvents="none">
        {/* Head behind shells — clipped by root overflow so it cannot spill. */}
        <Animated.View style={[styles.layer, headStyle]}>
          <Image
            source={hatchHead as ImageSourcePropType}
            style={{
              position: 'absolute',
              left: size * 0.106,
              top: size * 0.253,
              width: headWidth,
              height: headHeight,
            }}
            resizeMode="stretch"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
        <View style={styles.layer}>
          <EggBase size={size} />
        </View>
        <Animated.View style={[styles.layer, capStyle]}>
          <EggCap size={size} />
        </Animated.View>
        <Animated.View style={[styles.layer, crackStyle]}>
          <Svg width={size} height={size} viewBox="0 0 320 320">
            <Path
              d="M86 185 108 199 133 180 160 199 187 180 213 199 235 185"
              fill="none"
              stroke="#9D7B56"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </Animated.View>

      {mode === 'success' ? (
        <Animated.View style={[styles.layer, successStyle]} pointerEvents="none">
          <Image
            source={hatchSuccess as ImageSourcePropType}
            style={{ width: size, height: imgH, marginTop: imgTop }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </Animated.View>
      ) : null}

      {mode === 'success' && !reduceMotion ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.spark, { top: size * 0.14, right: size * 0.16 }, sparkAStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.spark, { top: size * 0.36, left: size * 0.12 }, sparkBStyle]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.spark,
              styles.sparkDot,
              { top: size * 0.52, right: size * 0.14 },
              sparkCStyle,
            ]}
          />
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#FFD244',
  },
  sparkDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
