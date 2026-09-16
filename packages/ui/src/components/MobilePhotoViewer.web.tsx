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
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';
import type { MobilePhotoViewerProps } from './MobilePhotoViewer';

/** Web fallback — full-screen preview without native pinch zoom. */
export function MobilePhotoViewer({
  visible,
  mode,
  items = [],
  index = 0,
  onIndexChange,
  beforeUri,
  afterUri,
  initialSide = 'after',
  labels,
  onClose,
}: MobilePhotoViewerProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(index);
  const [compareSide, setCompareSide] = useState<'before' | 'after'>(initialSide);

  const galleryItems = items.length > 0 ? items : [];
  const currentItem = galleryItems[activeIndex];
  const showEnhancedBadge =
    mode === 'gallery' && !!currentItem && (currentItem.enhanced || !!currentItem.beforeUri);
  const compareActiveUri =
    mode === 'compare' ? (compareSide === 'before' ? beforeUri : afterUri) : galleryItems[activeIndex]?.uri;
  const title = mode === 'gallery' ? labels.titlePreview : labels.titleCompare;

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(index);
    setCompareSide(initialSide);
  }, [visible, index, initialSide]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const goPrev = () => {
    if (mode !== 'gallery' || activeIndex <= 0) return;
    const next = activeIndex - 1;
    setActiveIndex(next);
    onIndexChange?.(next);
  };

  const goNext = () => {
    if (mode !== 'gallery' || activeIndex >= galleryItems.length - 1) return;
    const next = activeIndex + 1;
    setActiveIndex(next);
    onIndexChange?.(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.title}>{title}</Text>
            {showEnhancedBadge ? (
              <View style={styles.enhancedBadge}>
                <Text style={styles.enhancedBadgeText}>{labels.enhancedBadge}</Text>
              </View>
            ) : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={labels.closeA11y} onPress={onClose} style={styles.closeBtn}>
            <MobileIcon name="close" size={18} color={tokens.colors.primary} />
          </Pressable>
        </View>

        {mode === 'compare' ? (
          <View style={styles.segmentRow}>
            <View style={styles.segment}>
              {(['before', 'after'] as const).map((key) => {
                const active = compareSide === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    onPress={() => setCompareSide(key)}
                    style={[styles.segmentItem, active ? styles.segmentItemActive : null]}
                  >
                    <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
                      {key === 'before' ? labels.before : labels.after}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.stage} maximumZoomScale={3} minimumZoomScale={1} centerContent>
          {visible && compareActiveUri ? (
            <Image
              key={compareActiveUri}
              source={{ uri: compareActiveUri }}
              style={{ width: width - 32, height: Math.max(240, height * 0.62), borderRadius: 8 }}
              resizeMode="contain"
            />
          ) : null}
        </ScrollView>

        {mode === 'gallery' && galleryItems.length > 1 ? (
          <View style={styles.navRow}>
            <Pressable onPress={goPrev} disabled={activeIndex <= 0} style={styles.navBtn}>
              <Text style={styles.navText}>‹</Text>
            </Pressable>
            <Text style={styles.navCount}>{activeIndex + 1}/{galleryItems.length}</Text>
            <Pressable onPress={goNext} disabled={activeIndex >= galleryItems.length - 1} style={styles.navBtn}>
              <Text style={styles.navText}>›</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'compare' ? <Text style={styles.caption}>{labels.enhancedCaption}</Text> : null}

        <View style={styles.footer}>
          {mode === 'gallery' ? (
            <Text style={styles.hint}>{labels.hintZoom}</Text>
          ) : (
            <>
              <Text style={styles.hint}>{labels.hintCompareSwitch}</Text>
              <Text style={styles.hint}>{labels.hintCompareClose}</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  headerMain: { flex: 1, gap: 6 },
  title: { fontFamily: tokens.typography.native.headingTh, fontSize: 17, lineHeight: 26, color: tokens.colors.white },
  enhancedBadge: { alignSelf: 'flex-start', backgroundColor: tokens.colors.brand[500], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  enhancedBadgeText: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, fontWeight: '700', color: tokens.colors.primary },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  segmentRow: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  segment: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', padding: 3, gap: 2 },
  segmentItem: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, minWidth: 88, alignItems: 'center' },
  segmentItemActive: { backgroundColor: tokens.colors.brand[500] },
  segmentText: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, fontWeight: '600', color: tokens.colors.white },
  segmentTextActive: { color: tokens.colors.primary },
  stage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 4 },
  navBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  navText: { color: tokens.colors.white, fontSize: 22, lineHeight: 24 },
  navCount: { color: tokens.colors.placeholder, fontSize: 13, lineHeight: 20 },
  caption: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 20, fontWeight: '600', color: tokens.colors.white, textAlign: 'center', paddingHorizontal: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 4, alignItems: 'center' },
  hint: { fontFamily: tokens.typography.native.body, fontSize: 12, lineHeight: 18, color: tokens.colors.placeholder, textAlign: 'center' },
});
