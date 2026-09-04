import React from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
}

export const MobileModePage: React.FC<MobileModePageProps> = ({
  screenTitle,
  header,
  children,
  bottomBar,
  scrollable = true,
}) => {
  const insets = useSafeAreaInsets();
  const { theme } = useMobileTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.header} />

      <View
        style={[
          styles.header,
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
        {scrollable ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={styles.bodyFill}>{children}</View>
        )}
      </View>

      {bottomBar ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>{bottomBar}</View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
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
    padding: 16,
    flexGrow: 1,
  },
  bodyFill: {
    flex: 1,
    minHeight: 0,
    padding: 16,
  },
  bottomBar: {},
});
