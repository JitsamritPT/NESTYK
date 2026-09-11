import React from 'react';
import { View, Text, StyleSheet, StatusBar, RefreshControl, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { UserRole } from '@nestyk/types';
import { useMobileTheme } from '../theme/ThemeContext';
import { tokens } from '../theme/tokens';

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

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
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
        <View style={[styles.body, { backgroundColor: theme.background }]}>
          <View style={styles.bodyFill}>{children}</View>
        </View>
        {bottomBar ? (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>{bottomBar}</View>
        ) : null}
      </View>
    );
  }

  return (
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
          contentContainerStyle={[styles.scrollContent, { paddingTop: 8 }]}
          contentInsetAdjustmentBehavior="never"
          alwaysBounceVertical={Boolean(onRefresh)}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
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
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8), backgroundColor: theme.background }]}>
          {bottomBar}
        </View>
      ) : null}
    </View>
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
