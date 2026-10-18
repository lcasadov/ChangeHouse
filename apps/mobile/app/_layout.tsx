import '../src/i18n';

import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAppFonts } from '../src/fonts/use-app-fonts';
import { initSentry } from '../src/observability/sentry';
import { AppThemeProvider } from '../src/theme/AppThemeProvider';

initSentry();
// El splash se mantiene hasta que Inter esté cargada (o haya fallado)
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { ready } = useAppFonts();

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppThemeProvider>
      <StatusBar style="auto" />
      <Slot />
    </AppThemeProvider>
  );
}
