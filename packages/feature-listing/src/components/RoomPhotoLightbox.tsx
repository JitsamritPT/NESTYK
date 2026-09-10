import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { fitContainer, ResumableZoom, useImageResolution } from 'react-native-zoom-toolkit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileButton, tokens } from '@nestyk/ui/native';

export type RoomPhotoLightboxProps = {
  visible: boolean;
  uri: string;
  beforeUri?: string;
  labels: {
    before: string;
    after: string;
    close: string;
  };
  onClose: () => void;
};

function ZoomableImage({ uri }: { uri: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { isFetching, resolution } = useImageResolution({ uri });
  const maxH = height - insets.top - insets.bottom - 120;
  const size = useMemo(() => {
    if (!resolution) return { width, height: maxH };
    return fitContainer(resolution.width / resolution.height, { width, height: maxH });
  }, [resolution, width, maxH]);

  if (isFetching || !resolution) {
    return <ActivityIndicator color="#FFFFFF" style={{ marginTop: 40 }} />;
  }

  return (
    <ResumableZoom maxScale={resolution}>
      <Image source={{ uri, cache: 'force-cache' }} style={size} resizeMethod="scale" resizeMode="contain" />
    </ResumableZoom>
  );
}

export function RoomPhotoLightbox({ visible, uri, beforeUri, labels, onClose }: RoomPhotoLightboxProps) {
  const insets = useSafeAreaInsets();
  const hasCompare = !!beforeUri && beforeUri !== uri;
  const [mode, setMode] = useState<'before' | 'after'>('after');
  const activeUri = hasCompare && mode === 'before' ? beforeUri! : uri;

  React.useEffect(() => {
    if (!visible) return;
    setMode('after');
  }, [visible, uri, beforeUri]);

  React.useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.header}>
          {hasCompare ? (
            <View style={styles.tabs}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMode('before')}
                style={[styles.tab, mode === 'before' && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === 'before' && styles.tabTextActive]}>{labels.before}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setMode('after')}
                style={[styles.tab, mode === 'after' && styles.tabActive]}
              >
                <Text style={[styles.tabText, mode === 'after' && styles.tabTextActive]}>{labels.after}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <MobileButton variant="outline" onPress={onClose}>{labels.close}</MobileButton>
        </View>
        <View style={styles.stage} key={activeUri}>
          {visible && activeUri ? <ZoomableImage uri={activeUri} /> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  tabText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabTextActive: {
    color: tokens.colors.textHeading,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
