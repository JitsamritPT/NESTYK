import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  fitContainer,
  ResumableZoom,
  useImageResolution,
  type ResumableZoomRefType,
} from 'react-native-zoom-toolkit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';

export type MobilePhotoViewerItem = {
  uri: string;
  beforeUri?: string;
  enhanced?: boolean;
};

export type MobilePhotoViewerLabels = {
  titlePreview: string;
  titleCompare: string;
  before: string;
  after: string;
  enhancedBadge: string;
  enhancedCaption: string;
  hintZoom: string;
  hintCompareSwitch: string;
  hintCompareClose: string;
  closeA11y: string;
};

export type MobilePhotoViewerProps = {
  visible: boolean;
  mode: 'gallery' | 'compare';
  items?: MobilePhotoViewerItem[];
  index?: number;
  onIndexChange?: (index: number) => void;
  beforeUri?: string;
  afterUri?: string;
  initialSide?: 'before' | 'after';
  labels: MobilePhotoViewerLabels;
  onClose: () => void;
};

function ZoomableImage({ uri }: { uri: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const zoomRef = useRef<ResumableZoomRefType>(null);
  const { isFetching, resolution } = useImageResolution({ uri });
  /** Pan only when zoomed — at 1x, let parent FlatList own horizontal swipe. */
  const [panEnabled, setPanEnabled] = useState(false);

  const maxH = height - insets.top - insets.bottom - 160;
  const size = useMemo(() => {
    if (!resolution) return { width: width - 32, height: maxH };
    return fitContainer(resolution.width / resolution.height, { width: width - 32, height: maxH });
  }, [resolution, width, maxH]);

  useEffect(() => {
    setPanEnabled(false);
  }, [uri]);

  const syncPanFromScale = useCallback(() => {
    const scale = zoomRef.current?.getState()?.scale ?? 1;
    setPanEnabled(scale > 1.02);
  }, []);

  if (isFetching || !resolution) {
    return <ActivityIndicator color="#FFFFFF" style={{ marginTop: 40 }} />;
  }

  return (
    <ResumableZoom
      ref={zoomRef}
      style={styles.zoomRoot}
      maxScale={resolution}
      tapsEnabled={false}
      pinchEnabled
      panEnabled={panEnabled}
      onPinchStart={() => setPanEnabled(true)}
      onGestureEnd={syncPanFromScale}
    >
      <Image source={{ uri, cache: 'force-cache' }} style={size} resizeMethod="scale" resizeMode="contain" />
    </ResumableZoom>
  );
}

function CompareSegment({
  side,
  labels,
  onChange,
}: {
  side: 'before' | 'after';
  labels: Pick<MobilePhotoViewerLabels, 'before' | 'after'>;
  onChange: (side: 'before' | 'after') => void;
}) {
  return (
    <View style={styles.segment}>
      {(['before', 'after'] as const).map((key) => {
        const active = side === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(key)}
            style={[styles.segmentItem, active ? styles.segmentItemActive : null]}
          >
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
              {key === 'before' ? labels.before : labels.after}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

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
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(index);
  const [compareSide, setCompareSide] = useState<'before' | 'after'>(initialSide);
  const listRef = useRef<FlatList<MobilePhotoViewerItem>>(null);

  const galleryItems = items.length > 0 ? items : [];
  const currentItem = galleryItems[activeIndex];
  const showEnhancedBadge =
    mode === 'gallery' && !!currentItem && (currentItem.enhanced || !!currentItem.beforeUri);
  const canGoPrev = mode === 'gallery' && activeIndex > 0;
  const canGoNext = mode === 'gallery' && activeIndex < galleryItems.length - 1;

  const compareActiveUri =
    mode === 'compare' ? (compareSide === 'before' ? beforeUri : afterUri) : undefined;

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(index);
    setCompareSide(initialSide);
  }, [visible, index, initialSide]);

  useEffect(() => {
    if (!visible || mode !== 'gallery' || galleryItems.length === 0) return;
    const target = Math.min(Math.max(index, 0), galleryItems.length - 1);
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: target, animated: false });
    });
  }, [visible, mode, index, galleryItems.length]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const goToIndex = useCallback(
    (next: number, animated = true) => {
      if (next < 0 || next >= galleryItems.length) return;
      setActiveIndex(next);
      onIndexChange?.(next);
      listRef.current?.scrollToIndex({ index: next, animated });
    },
    [galleryItems.length, onIndexChange],
  );

  const onGalleryScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);
      if (next === activeIndex || next < 0 || next >= galleryItems.length) return;
      setActiveIndex(next);
      onIndexChange?.(next);
    },
    [activeIndex, galleryItems.length, onIndexChange, width],
  );

  const renderGalleryItem = useCallback(
    ({ item }: ListRenderItemInfo<MobilePhotoViewerItem>) => (
      <View style={[styles.page, { width }]} pointerEvents="box-none">
        <ZoomableImage uri={item.uri} />
      </View>
    ),
    [width],
  );

  const title = mode === 'gallery' ? labels.titlePreview : labels.titleCompare;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.flex}>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.closeA11y}
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <MobileIcon name="close" size={18} color={tokens.colors.primary} />
            </Pressable>
          </View>

          {mode === 'compare' ? (
            <View style={styles.segmentRow}>
              <CompareSegment
                side={compareSide}
                labels={{ before: labels.before, after: labels.after }}
                onChange={setCompareSide}
              />
            </View>
          ) : null}

          <View style={styles.stage}>
            {mode === 'gallery' && visible && galleryItems.length > 0 ? (
              <FlatList
                ref={listRef}
                data={galleryItems}
                keyExtractor={(item, i) => `${item.uri}-${i}`}
                horizontal
                pagingEnabled
                bounces={false}
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={Math.min(Math.max(index, 0), galleryItems.length - 1)}
                getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                onScrollToIndexFailed={({ index: failedIndex }) => {
                  listRef.current?.scrollToOffset({ offset: width * failedIndex, animated: false });
                }}
                onMomentumScrollEnd={onGalleryScrollEnd}
                renderItem={renderGalleryItem}
              />
            ) : null}
            {mode === 'compare' && visible && compareActiveUri ? (
              <View style={styles.page}>
                <ZoomableImage uri={compareActiveUri} />
              </View>
            ) : null}
          </View>

          {mode === 'gallery' && galleryItems.length > 1 ? (
            <View style={styles.navRow}>
              <Pressable
                accessibilityRole="button"
                disabled={!canGoPrev}
                onPress={() => goToIndex(activeIndex - 1)}
                style={[styles.navBtn, !canGoPrev ? styles.navBtnDisabled : null]}
              >
                <Text style={styles.navText}>‹</Text>
              </Pressable>
              <Text style={styles.navCount}>
                {activeIndex + 1}/{galleryItems.length}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={!canGoNext}
                onPress={() => goToIndex(activeIndex + 1)}
                style={[styles.navBtn, !canGoNext ? styles.navBtnDisabled : null]}
              >
                <Text style={styles.navText}>›</Text>
              </Pressable>
            </View>
          ) : null}

          {mode === 'compare' ? (
            <Text style={styles.caption}>{labels.enhancedCaption}</Text>
          ) : null}

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
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  headerMain: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    color: tokens.colors.white,
  },
  enhancedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.brand[500],
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  enhancedBadgeText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    color: tokens.colors.primary,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentRow: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 88,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: tokens.colors.brand[500],
  },
  segmentText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.white,
  },
  segmentTextActive: {
    color: tokens.colors.primary,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomRoot: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 6,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navText: {
    color: tokens.colors.white,
    fontSize: 22,
    lineHeight: 24,
  },
  navCount: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.placeholder,
    minWidth: 48,
    textAlign: 'center',
  },
  caption: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: tokens.colors.white,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 4,
    alignItems: 'center',
  },
  hint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.placeholder,
    textAlign: 'center',
  },
});
