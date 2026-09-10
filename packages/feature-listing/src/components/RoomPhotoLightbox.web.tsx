import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileButton, tokens } from '@nestyk/ui/native';
import type { RoomPhotoLightboxProps } from './RoomPhotoLightbox';

/** Web fallback — full-screen preview without native pinch zoom. */
export function RoomPhotoLightbox({ visible, uri, beforeUri, labels, onClose }: RoomPhotoLightboxProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const hasCompare = !!beforeUri && beforeUri !== uri;
  const [mode, setMode] = useState<'before' | 'after'>('after');
  const activeUri = hasCompare && mode === 'before' ? beforeUri! : uri;

  useEffect(() => {
    if (!visible) return;
    setMode('after');
  }, [visible, uri, beforeUri]);

  useEffect(() => {
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
              <Pressable accessibilityRole="button" onPress={() => setMode('before')} style={[styles.tab, mode === 'before' && styles.tabActive]}>
                <Text style={[styles.tabText, mode === 'before' && styles.tabTextActive]}>{labels.before}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setMode('after')} style={[styles.tab, mode === 'after' && styles.tabActive]}>
                <Text style={[styles.tabText, mode === 'after' && styles.tabTextActive]}>{labels.after}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <MobileButton variant="outline" onPress={onClose}>{labels.close}</MobileButton>
        </View>
        <ScrollView contentContainerStyle={styles.stage} maximumZoomScale={3} minimumZoomScale={1} centerContent>
          <Image
            key={activeUri}
            source={{ uri: activeUri }}
            style={{ width: width - 24, height: Math.max(240, height * 0.7), borderRadius: 8 }}
            resizeMode="contain"
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.96)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 8 },
  tabs: { flex: 1, flexDirection: 'row', gap: 8 },
  tab: { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 8 },
  tabActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  tabText: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, fontWeight: '600', color: '#FFFFFF' },
  tabTextActive: { color: tokens.colors.textHeading },
  stage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
});
