import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { LocaleProvider, resolveSupportedLocale } from '@nestyk/i18n';
import { MobileThemeProvider, MobilePreloadScreen } from '@nestyk/ui/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AuthProvider, useAuth } from '../lib/auth/AuthContext';
import { Mitr_400Regular, Mitr_500Medium } from '@expo-google-fonts/mitr';
import {
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
} from '@expo-google-fonts/baloo-2';
import {
  NotoSansThai_400Regular,
  NotoSansThai_500Medium,
  NotoSansThai_600SemiBold,
  NotoSansThai_700Bold,
} from '@expo-google-fonts/noto-sans-thai';

SplashScreen.preventAutoHideAsync();

const PRELOAD_MIN_MS = 1100;

const deviceLocale = resolveSupportedLocale(
  Localization.getLocales()[0]?.languageTag ?? Localization.getLocales()[0]?.languageCode,
);

function BootstrapGate({ children }: { children: React.ReactNode }) {
  const { ready } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), PRELOAD_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  const bootstrapReady = ready && minElapsed;
  const showPreload = !entered;

  return (
    <>
      {children}
      {showPreload ? (
        <MobilePreloadScreen ready={bootstrapReady} onEnter={() => setEntered(true)} />
      ) : null}
    </>
  );
}

export default function Layout() {
  const [fontsLoaded, fontError] = useFonts({
    Mitr_400Regular,
    Mitr_500Medium,
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    NotoSansThai_400Regular,
    NotoSansThai_500Medium,
    NotoSansThai_600SemiBold,
    NotoSansThai_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <LocaleProvider defaultLocale={deviceLocale}>
        <MobileThemeProvider>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <BootstrapGate>
                <Slot />
              </BootstrapGate>
            </GestureHandlerRootView>
          </AuthProvider>
        </MobileThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
