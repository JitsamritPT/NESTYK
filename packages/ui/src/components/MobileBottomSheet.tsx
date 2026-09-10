import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
  BackHandler,
  Platform,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';

const SHEET_EASE = Easing.out(Easing.cubic);

export interface MobileBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Sheet max height — default 85%. */
  maxHeight?: number | `${number}%`;
  /** Extra style for the sheet panel. */
  sheetStyle?: ViewStyle;
  /** Show the drag handle (default true). */
  showHandle?: boolean;
  /** Dimmed backdrop press closes (default true). */
  closeOnBackdropPress?: boolean;
  testID?: string;
}

/**
 * Bottom sheet with correct motion: scrim fades in place, panel slides up.
 * Never use Modal `animationType="slide"` for sheets — it animates the overlay too.
 */
export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  visible,
  onClose,
  children,
  maxHeight = '85%',
  sheetStyle,
  showHandle = true,
  closeOnBackdropPress = true,
  testID,
}) => {
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const hiddenY = Math.min(windowHeight * 0.7, 640);

  const [mounted, setMounted] = useState(false);
  const scrimOpacity = useSharedValue(0);
  const translateY = useSharedValue(hiddenY);

  const finishUnmount = useCallback(() => {
    setMounted(false);
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = hiddenY;
      scrimOpacity.value = 0;
      scrimOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 280, easing: SHEET_EASE });
      return;
    }
    if (!mounted) return;
    scrimOpacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(
      hiddenY,
      { duration: 240, easing: SHEET_EASE },
      (finished) => {
        if (finished) runOnJS(finishUnmount)();
      },
    );
  }, [visible, mounted, hiddenY, scrimOpacity, translateY, finishUnmount]);

  useEffect(() => {
    if (!mounted || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [mounted, onClose]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} testID={testID}>
      <View style={styles.root} pointerEvents="box-none">
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, scrimStyle, { backgroundColor: theme.overlay }]}
        />
        {closeOnBackdropPress ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        ) : null}
        <Animated.View
          style={[
            styles.sheet,
            panelStyle,
            {
              backgroundColor: theme.card,
              paddingBottom: Math.max(insets.bottom, 16),
              maxHeight,
            },
            sheetStyle,
          ]}
          accessibilityViewIsModal
        >
          {showHandle ? (
            <View style={[styles.handle, { backgroundColor: theme.border }]} />
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
    backgroundColor: tokens.colors.border,
  },
});
