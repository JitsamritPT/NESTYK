import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Platform,
  findNodeHandle,
  UIManager,
  type View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { UserRole } from '@nestyk/types';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';

export type ModePageScrollApi = {
  scrollTo: (options?: { y?: number; animated?: boolean }) => void;
  scrollToView: (
    target: React.RefObject<RNView | null> | RNView | null,
    options?: { offset?: number; animated?: boolean },
  ) => void;
  /** Called when the page is scrolled near its end (infinite lists). Returns an unsubscribe. */
  onEndReached: (handler: () => void) => () => void;
};

/** Distance from the bottom (px) that counts as "near the end". */
const END_REACHED_THRESHOLD = 480;

export const ModePageScrollContext = React.createContext<ModePageScrollApi | null>(null);

export interface MobileModePageProps {
  role?: UserRole | 'services';
  screenTitle?: string;
  header?: React.ReactNode;
  children: React.ReactNode;
  bottomBar?: React.ReactNode;
  scrollable?: boolean;
  /** Pull-to-refresh via layout template — enable on all scrollable ModePages (not wizards). */
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const MobileModePage: React.FC<MobileModePageProps> = ({
  screenTitle,
  header,
  children,
  bottomBar,
  scrollable = true,
  refreshing = false,
  onRefresh,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useMobileTheme();
  const scrollY = useSharedValue(0);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const endHandlerRef = useRef<(() => void) | null>(null);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const nearEnd = useSharedValue(false);

  const fireEndReached = useCallback(() => endHandlerRef.current?.(), []);
  // Content that grows (or starts) short of the viewport never scrolls, so re-check on size changes.
  const checkNearEnd = useCallback(() => {
    if (!viewportHeight.current || !contentHeight.current) return;
    if (scrollY.value + viewportHeight.current >= contentHeight.current - END_REACHED_THRESHOLD) {
      fireEndReached();
    }
  }, [fireEndReached, scrollY]);

  const scrollApi = useMemo<ModePageScrollApi>(
    () => ({
      scrollTo: (options) => {
        scrollRef.current?.scrollTo({
          y: options?.y ?? 0,
          animated: options?.animated ?? true,
        });
      },
      scrollToView: (target, options) => {
        const node =
          target && 'current' in (target as object)
            ? (target as React.RefObject<RNView | null>).current
            : (target as RNView | null);
        const scrollNode = findNodeHandle(scrollRef.current);
        const targetNode = findNodeHandle(node);
        if (!scrollNode || !targetNode) return;
        UIManager.measureLayout(
          targetNode,
          scrollNode,
          () => undefined,
          (_x, y) => {
            scrollRef.current?.scrollTo({
              y: Math.max(0, y - (options?.offset ?? 12)),
              animated: options?.animated ?? true,
            });
          },
        );
      },
      onEndReached: (handler) => {
        endHandlerRef.current = handler;
        return () => {
          if (endHandlerRef.current === handler) endHandlerRef.current = null;
        };
      },
    }),
    [],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const near =
        event.contentOffset.y + event.layoutMeasurement.height >=
        event.contentSize.height - END_REACHED_THRESHOLD;
      if (near !== nearEnd.value) {
        nearEnd.value = near;
        if (near) runOnJS(fireEndReached)();
      }
    },
  });

  const headerBorderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [0.12, 1], Extrapolation.CLAMP),
  }));

  const headerShadowStyle = useAnimatedStyle(() => {
    const elevation = interpolate(scrollY.value, [0, 48], [0, 3], Extrapolation.CLAMP);
    return {
      shadowOpacity: interpolate(scrollY.value, [0, 48], [0, 0.08], Extrapolation.CLAMP),
      shadowRadius: interpolate(scrollY.value, [0, 48], [0, 8], Extrapolation.CLAMP),
      elevation: Platform.OS === 'android' ? elevation : 0,
    };
  });

  const headerBlock = (
    <View
      style={[
        styles.headerInner,
        {
          paddingTop: Math.max(insets.top, 8),
        },
      ]}
    >
      {header}
      {screenTitle ? (
        <Text style={[styles.screenTitle, { color: theme.screenTitle }]}>{screenTitle}</Text>
      ) : null}
    </View>
  );

  if (!scrollable) {
    return (
      <ModePageScrollContext.Provider value={null}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.header} />
        <View
          style={[
            styles.headerSolid,
            {
              paddingTop: Math.max(insets.top, 8),
              backgroundColor: theme.header,
              borderBottomColor: theme.border,
            },
          ]}
        >
          {header}
          {screenTitle ? (
            <Text style={[styles.screenTitle, { color: theme.screenTitle }]}>{screenTitle}</Text>
          ) : null}
        </View>
        <View style={[styles.body, { backgroundColor: theme.background, paddingBottom: bottomBar ? 0 : insets.bottom }]}>
          <View style={styles.bodyFill}>{children}</View>
        </View>
        {bottomBar ? (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.surface }]}>{bottomBar}</View>
        ) : null}
      </View>
      </ModePageScrollContext.Provider>
    );
  }

  return (
    <ModePageScrollContext.Provider value={scrollApi}>
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} translucent backgroundColor="transparent" />

      {/* Outside the scroll viewport: native refresh always appears below the header. */}
      <Animated.View
        style={[
          styles.headerOverlay,
          headerShadowStyle,
          { backgroundColor: theme.header, shadowColor: '#000', shadowOffset: { width: 0, height: 2 } },
        ]}
      >
        {headerBlock}
        <Animated.View
          pointerEvents="none"
          style={[styles.headerBorder, headerBorderStyle, { backgroundColor: theme.border }]}
        />
      </Animated.View>

      <View style={[styles.body, { backgroundColor: theme.background }]}>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 8, paddingBottom: bottomBar ? 16 : 16 + insets.bottom },
          ]}
          contentInsetAdjustmentBehavior="never"
          alwaysBounceVertical={Boolean(onRefresh)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          onLayout={(e) => {
            viewportHeight.current = e.nativeEvent.layout.height;
            checkNearEnd();
          }}
          onContentSizeChange={(_w, h) => {
            contentHeight.current = h;
            checkNearEnd();
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={tokens.colors.primary}
                colors={[tokens.colors.brand[700]]}
                progressBackgroundColor={theme.surface}
              />
            ) : undefined
          }
        >
          {children}
        </Animated.ScrollView>
      </View>

      {bottomBar ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.surface }]}>
          {bottomBar}
        </View>
      ) : null}
    </View>
    </ModePageScrollContext.Provider>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerOverlay: {
    flexShrink: 0,
    zIndex: 20,
  },
  headerInner: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerSolid: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBorder: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  screenTitle: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 26,
    lineHeight: 39,
    fontWeight: '500',
    marginTop: 12,
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  bodyFill: {
    flex: 1,
    minHeight: 0,
    padding: 16,
  },
  bottomBar: {},
});
