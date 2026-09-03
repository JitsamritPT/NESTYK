import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Dimensions, BackHandler, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMobileTheme } from '../theme/ThemeContext';

export interface MobileNotificationsPanelProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const MobileNotificationsPanel: React.FC<MobileNotificationsPanelProps> = ({
  visible,
  onClose,
  children,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useMobileTheme();
  const [mounted, setMounted] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  const translateX = useSharedValue(screenWidth);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateX.value = withTiming(0, { duration: 250 });
    } else if (mounted) {
      translateX.value = withTiming(screenWidth, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, screenWidth, translateX]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.panel,
          panelStyle,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            backgroundColor: theme.surface,
          },
        ]}
      >
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
});
