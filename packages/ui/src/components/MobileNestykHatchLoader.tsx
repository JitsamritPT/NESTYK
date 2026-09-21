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

/** Idle narrative loop (~6.2s) — rock → crack → small peek → close. */
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

function SoftEgg({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 320 320">
      <Defs>
        <LinearGradient id="nestykEggFill" x1="0.2" y1="0" x2="0.78" y2="1">
          <Stop offset="0" stopColor="#FFFDF7" />
          <Stop offset="0.48" stopColor="#FFF8E8" />
          <Stop offset="1" stopColor="#DDC9A3" />
        </LinearGradient>
        <RadialGradient id="nestykEggLight" cx="31%" cy="22%" r="70%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path
        d="M160 49C119 49 83 121 83 187 83 235 112 259 160 259S237 235 237 187C237 121 201 49 160 49Z"
        fill="url(#nestykEggFill)"
      />
      <Path
        d="M160 49C119 49 83 121 83 187 83 235 112 259 160 259S237 235 237 187C237 121 201 49 160 49Z"
        fill="url(#nestykEggLight)"
      />
      <Path
        d="M105 120Q121 79 151 67"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.55}
      />
    </Svg>
  );
}

function EggBase({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 320 320">
      <Defs>
        <LinearGradient id="nestykBaseFill" x1="0.2" y1="0" x2="0.78" y2="1">
          <Stop offset="0" stopColor="#FFFDF7" />
          <Stop offset="0.48" stopColor="#FFF8E8" />
          <Stop offset="1" stopColor="#DDC9A3" />
        </LinearGradient>
        <RadialGradient id="nestykBaseLight" cx="31%" cy="22%" r="70%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
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

function EggCap({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 320 320">
      <Defs>
        <LinearGradient id="nestykCapFill" x1="0.2" y1="0" x2="0.78" y2="1">
          <Stop offset="0" stopColor="#FFFDF7" />
          <Stop offset="0.48" stopColor="#FFF8E8" />
          <Stop offset="1" stopColor="#DDC9A3" />
        </LinearGradient>
        <RadialGradient id="nestykCapLight" cx="31%" cy="22%" r="70%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
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
 * Honey & Cream 2.5D hatch loader — PNG mascot + soft egg (no flat black-stroke bird).
 * Idle loops 6.2s with a small peek; Success plays once then holds with spark twinkle.
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

  const eggOpacity = useSharedValue(1);
  const eggRotate = useSharedValue(0);
  const crackOpacity = useSharedValue(0);
  const capY = useSharedValue(0);
  const capRotate = useSharedValue(0);
  const peekOpacity = useSharedValue(0);
  const peekY = useSharedValue(12);
  const peekScale = useSharedValue(0.96);
  const peekRotate = useSharedValue(0);
  const successOpacity = useSharedValue(0);
  const successY = useSharedValue(24);
  const successScale = useSharedValue(0.9);
  const shadowScale = useSharedValue(1);
  const sparkA = useSharedValue(0);
  const sparkB = useSharedValue(0);
  const sparkC = useSharedValue(0);

  const allValsRef = useRef<SharedValue<number>[]>([]);
  allValsRef.current = [
    eggOpacity,
    eggRotate,
    crackOpacity,
    capY,
    capRotate,
    peekOpacity,
    peekY,
    peekScale,
    peekRotate,
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

    if (!appActive) {
      return () => stopAll(vals);
    }

    if (reduceMotion) {
      eggRotate.value = 0;
      capY.value = 0;
      capRotate.value = 0;
      peekY.value = 0;
      peekScale.value = 1;
      peekRotate.value = 0;
      successY.value = 0;
      successScale.value = 1;
      shadowScale.value = 1;
      sparkA.value = 0;
      sparkB.value = 0;
      sparkC.value = 0;
      if (mode === 'success') {
        eggOpacity.value = 0;
        crackOpacity.value = 0;
        peekOpacity.value = 0;
        successOpacity.value = 1;
        sparkA.value = 0.75;
        onSuccessRef.current?.();
      } else {
        eggOpacity.value = 1;
        crackOpacity.value = 0;
        peekOpacity.value = 0;
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

      eggOpacity.value = 1;
      eggRotate.value = 0;
      crackOpacity.value = 0;
      capY.value = 0;
      capRotate.value = 0;
      peekOpacity.value = 0;
      peekY.value = 18;
      peekScale.value = 0.98;
      peekRotate.value = 0;
      shadowScale.value = 1;

      // One continuous 6.2s story: rock → crack → cap lifts → tiny peek → close.
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

      eggOpacity.value = 1;

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
          withTiming(-22, { duration: 620, easing: soft }),
          withTiming(-29, { duration: 434, easing: soft }),
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
          withTiming(-1, { duration: 620, easing: soft }),
          withTiming(-2, { duration: 434, easing: soft }),
          withTiming(-2, { duration: 930 }),
          withTiming(-0.7, { duration: 434, easing: soft }),
          withTiming(0, { duration: 558, easing: soft }),
          withTiming(0, { duration: 1302 }),
        ),
        -1,
        false,
      );

      peekOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 2108 }),
          withTiming(0.35, { duration: 434, easing: soft }),
          withTiming(1, { duration: 434, easing: soft }),
          withTiming(1, { duration: 930 }),
          withTiming(0.7, { duration: 434, easing: soft }),
          withTiming(0, { duration: 310, easing: soft }),
          withTiming(0, { duration: 1550 }),
        ),
        -1,
        false,
      );

      peekY.value = withRepeat(
        withSequence(
          withTiming(18, { duration: 2108 }),
          withTiming(10, { duration: 434, easing: soft }),
          withTiming(0, { duration: 434, easing: soft }),
          withTiming(-1, { duration: 310, easing: ease }),
          withTiming(0, { duration: 310, easing: ease }),
          withTiming(0, { duration: 310 }),
          withTiming(9, { duration: 434, easing: soft }),
          withTiming(18, { duration: 310, easing: soft }),
          withTiming(18, { duration: 1550 }),
        ),
        -1,
        false,
      );

      peekScale.value = withRepeat(
        withSequence(
          withTiming(0.98, { duration: 2108 }),
          withTiming(1, { duration: 868, easing: soft }),
          withTiming(1, { duration: 930 }),
          withTiming(0.99, { duration: 744, easing: soft }),
          withTiming(0.98, { duration: 1550 }),
        ),
        -1,
        false,
      );

      // Gentle head tilt (life) — no separate blink layers in PNG
      peekRotate.value = withRepeat(
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

    // Success — cancel idle, hatch once, hold + sparks
    peekOpacity.value = withTiming(0, { duration: 160 });
    crackOpacity.value = withTiming(0.65, { duration: 400 });
    eggOpacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withTiming(0, { duration: 500, easing: ease }),
    );
    eggRotate.value = withTiming(0, { duration: 200 });

    successOpacity.value = 0;
    successY.value = 28;
    successScale.value = 0.88;
    sparkA.value = 0;
    sparkB.value = 0;
    sparkC.value = 0;

    const hatchEase = Easing.bezier(0.18, 0.8, 0.28, 1);

    successOpacity.value = withDelay(520, withTiming(1, { duration: 280 }));
    successY.value = withDelay(
      520,
      withSequence(
        withTiming(-4, { duration: 620, easing: hatchEase }),
        withTiming(0, { duration: 280, easing: ease }),
      ),
    );
    successScale.value = withDelay(
      520,
      withSequence(
        withTiming(1.03, { duration: 620, easing: hatchEase }),
        withTiming(1, { duration: 280, easing: ease }),
      ),
    );
    shadowScale.value = withDelay(
      520,
      withSequence(
        withTiming(0.85, { duration: 400, easing: ease }),
        withTiming(1.08, { duration: 280, easing: ease }),
        withTiming(1, { duration: 220, easing: ease }),
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
    twinkle(sparkA, 1800);
    twinkle(sparkB, 2300);
    twinkle(sparkC, 2800);

    successTimer = setTimeout(() => onSuccessRef.current?.(), NESTYK_HATCH_DURATION_MS);

    return () => {
      if (successTimer) clearTimeout(successTimer);
      stopAll(vals);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reduceMotion, appActive]);

  const eggStyle = useAnimatedStyle(() => ({
    opacity: eggOpacity.value,
    transform: [{ rotate: `${eggRotate.value}deg` }],
  }));

  const capStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: capY.value * (size / 320) },
      { rotate: `${capRotate.value}deg` },
    ],
  }));

  const crackStyle = useAnimatedStyle(() => ({
    opacity: crackOpacity.value,
  }));

  const peekStyle = useAnimatedStyle(() => ({
    opacity: peekOpacity.value,
    transform: [
      { translateY: peekY.value * (size / 320) },
      { scale: peekScale.value },
      { rotate: `${peekRotate.value}deg` },
    ],
  }));

  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
    transform: [
      { translateY: successY.value },
      { scale: successScale.value },
    ],
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

      {mode === 'idle' ? (
        <Animated.View style={[styles.layer, eggStyle]} pointerEvents="none">
          <Animated.View style={[styles.layer, peekStyle]}>
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
                d="M88 186 111 201 135 181 160 201 186 181 212 201 233 186"
                fill="none"
                stroke="#9D7B56"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.layer, eggStyle]} pointerEvents="none">
          <SoftEgg size={size} />
          <Animated.View style={[styles.layer, crackStyle]}>
            <Svg width={size} height={size} viewBox="0 0 320 320">
              <Path
                d="M88 186 111 201 135 181 160 201 186 181 212 201 233 186"
                fill="none"
                stroke="#9D7B56"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Animated.View>
        </Animated.View>
      )}

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
            style={[
              styles.spark,
              { top: size * 0.14, right: size * 0.16 },
              sparkAStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.spark,
              { top: size * 0.36, left: size * 0.12 },
              sparkBStyle,
            ]}
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
