import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Image,
  ImageSourcePropType,
  Pressable,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@nestyk/i18n';
import { MobileNestykLogo } from './MobileNestykLogo';
import { tokens } from '../theme/tokens';
import preloadBackground from '../../assets/backgrounds/preload-background.png';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const BRAND = tokens.colors.brand[500];
const INK = tokens.colors.primary;
const TRACK = '#E5E7EB';

/** Smile arc — viewBox 240×90, width matches wordmark scale. */
const SMILE_D = 'M 28 32 Q 120 98 212 32';
const SMILE_LENGTH = 248;
const SMILE_WIDTH = 236;
const SMILE_HEIGHT = 90;

export interface MobilePreloadScreenProps {
  /** Bootstrap finished (auth + min delay). */
  ready?: boolean;
  /** User taps to dismiss preload and enter the app. */
  onEnter?: () => void;
}

function SmileProgress({
  progress,
  onFilled,
}: {
  progress: number;
  onFilled?: () => void;
}) {
  const dash = useSharedValue(0.12);
  const filledRef = React.useRef(false);

  useEffect(() => {
    const target = Math.max(0.04, Math.min(1, progress));
    dash.value = withTiming(
      target,
      { duration: target >= 0.99 ? 420 : 700, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished && target >= 0.99 && onFilled && !filledRef.current) {
          filledRef.current = true;
          runOnJS(onFilled)();
        }
      },
    );
  }, [progress, dash, onFilled]);

  const animatedProps = useAnimatedProps(() => {
    const len = SMILE_LENGTH * dash.value;
    return {
      strokeDasharray: `${len} ${SMILE_LENGTH}`,
      strokeDashoffset: 0,
    };
  });

  return (
    <View
      style={styles.smileWrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
    >
      <Svg width={SMILE_WIDTH} height={SMILE_HEIGHT} viewBox="0 0 240 90">
        <Defs>
          <LinearGradient id="smileGlow" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={BRAND} stopOpacity="0.1" />
            <Stop offset="0.5" stopColor={BRAND} stopOpacity="0.4" />
            <Stop offset="1" stopColor={BRAND} stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        <Path
          d={SMILE_D}
          stroke={TRACK}
          strokeWidth={11}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d={SMILE_D}
          stroke="url(#smileGlow)"
          strokeWidth={18}
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
        />
        <AnimatedPath
          d={SMILE_D}
          stroke={BRAND}
          strokeWidth={11}
          strokeLinecap="round"
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}

function SoftBackdrop() {
  const insets = useSafeAreaInsets();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={preloadBackground as ImageSourcePropType}
        style={styles.backdropImage}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
      <Text style={[styles.cornerText, { top: insets.top + 20, right: 18 }]} numberOfLines={1}>
        A MORE CONNECTED TOMORROW
      </Text>
      <Text
        style={[styles.cornerText, { bottom: Math.max(insets.bottom, 16) + 14, left: 18 }]}
        numberOfLines={1}
      >
        SPACES · PEOPLE · PROGRESS
      </Text>
    </View>
  );
}

/** Branded preload — smile progress, then welcome + tap to enter. */
export const MobilePreloadScreen: React.FC<MobilePreloadScreenProps> = ({
  ready = false,
  onEnter,
}) => {
  const { t, locale } = useLocale();
  const { width, height } = useWindowDimensions();
  const copy = t.mobile.preload;
  const [phase, setPhase] = useState<'loading' | 'welcome'>('loading');
  const [progress, setProgress] = useState(0.18);
  const pulse = useSharedValue(1);
  const compact = height < 720 || width < 360;

  const primary = locale === 'en' ? copy.preparingEn : copy.preparing;
  const secondary = locale === 'en' ? copy.preparing : copy.preparingEn;

  useEffect(() => {
    if (ready) {
      setProgress(1);
      return;
    }
    setPhase('loading');
    setProgress(0.22);
    const t1 = setTimeout(() => setProgress(0.48), 280);
    const t2 = setTimeout(() => setProgress(0.72), 650);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready]);

  useEffect(() => {
    if (phase !== 'welcome') return;
    pulse.value = withRepeat(
      withTiming(0.35, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [phase, pulse]);

  const welcomeStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const handleFilled = useCallback(() => {
    setPhase('welcome');
  }, []);

  const content = (
    <>
      <SoftBackdrop />
      <View style={styles.center} pointerEvents="none">
        <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
          <MobileNestykLogo variant="mark" height={compact ? 108 : 128} />
        </View>
        <MobileNestykLogo
          variant="wordmark"
          height={compact ? 44 : 52}
          style={[styles.wordmark, compact && styles.wordmarkCompact]}
        />

        {/* Fixed-height message slot — sized for large welcome; loading uses same box */}
        <View style={[styles.messageSlot, compact && styles.messageSlotCompact]}>
          <Text
            style={
              phase === 'loading'
                ? styles.primary
                : [styles.welcomeTitle, compact && styles.welcomeTitleCompact]
            }
          >
            {phase === 'loading' ? primary : copy.welcome}
          </Text>
          <Text
            style={[
              styles.secondary,
              compact && styles.secondaryCompact,
              phase === 'welcome' && styles.slotHidden,
            ]}
          >
            {secondary}
          </Text>
        </View>

        <SmileProgress progress={progress} onFilled={ready ? handleFilled : undefined} />

        {/* Fixed-height hint slot — pushed lower */}
        <View style={[styles.hintSlot, compact && styles.hintSlotCompact]}>
          <Animated.Text
            style={[
              styles.tapHint,
              phase === 'welcome' ? welcomeStyle : styles.slotHidden,
            ]}
          >
            {copy.tapToEnter}
          </Animated.Text>
        </View>
      </View>
    </>
  );

  return (
    <Pressable
      style={styles.root}
      onPress={phase === 'welcome' ? onEnter : undefined}
      disabled={phase !== 'welcome'}
      accessibilityRole={phase === 'welcome' ? 'button' : undefined}
      accessibilityLabel={phase === 'welcome' ? copy.tapToEnter : primary}
      accessibilityLiveRegion="polite"
      accessibilityViewIsModal
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 100,
    elevation: 100,
  },
  backdropImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  /** Yellow circle mark — matches original brand preload. */
  iconCircle: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: BRAND,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.38,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  iconCircleCompact: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  wordmark: {
    marginTop: 22,
    marginBottom: 32,
  },
  wordmarkCompact: {
    marginTop: 18,
    marginBottom: 24,
  },
  primary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 17,
    lineHeight: 26,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  welcomeTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 26,
    lineHeight: 39,
    fontWeight: '600',
    color: INK,
    textAlign: 'center',
  },
  welcomeTitleCompact: {
    fontSize: 24,
    lineHeight: 36,
  },
  secondary: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    color: tokens.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  secondaryCompact: {},
  messageSlot: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    // Tall enough for large welcome + reserved secondary line (no layout jump)
    minHeight: 39 + 6 + 21,
    marginBottom: 28,
    width: '100%',
  },
  messageSlotCompact: {
    minHeight: 36 + 6 + 21,
    marginBottom: 20,
  },
  slotHidden: {
    opacity: 0,
  },
  smileWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  hintSlot: {
    minHeight: 21,
    marginTop: 28,
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintSlotCompact: {
    marginTop: 22,
    paddingTop: 6,
  },
  tapHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: BRAND,
    textAlign: 'center',
  },
  cornerText: {
    position: 'absolute',
    fontFamily: tokens.typography.native.body,
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 1.1,
    color: '#D1D5DB',
    fontWeight: '600',
  },
});
