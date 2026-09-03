import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import * as Localization from 'expo-localization';
import { LocaleProvider, resolveSupportedLocale } from '@nestyk/i18n';
import { MobileThemeProvider } from '@nestyk/ui/native';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
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

const deviceLocale = resolveSupportedLocale(
  Localization.getLocales()[0]?.languageTag ?? Localization.getLocales()[0]?.languageCode,
);

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
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Slot />
          </GestureHandlerRootView>
        </MobileThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
