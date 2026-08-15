// App.tsx — minimal boot (no splash gate)
import 'react-native-gesture-handler';
import './global.css';
import './utils/webThemePolyfill';

import React, { useEffect, useState } from 'react';
import {
  Platform,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import RootNavigator from './navigation/Navigation';
import NotificationManager from './components/NotificationManager';
import { startAutoBootstrap } from './services/autoBootstrapService';
import { initSupabaseFromStorage } from './services/supabaseClient';
import { restoreAuthSession } from './services/authService';

function BootShell({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();
  const [bootDone, setBootDone] = useState(false);
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });
  // Don't block the UI forever if the icon font fails (Electron/web edge cases)
  const [fontWaitDone, setFontWaitDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontWaitDone(true), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const finish = () => {
      if (!alive) return;
      setBootDone(true);
      SplashScreen.hideAsync().catch(() => {});
    };

    // Hide splash ASAP
    SplashScreen.hideAsync().catch(() => {});
    const t1 = setTimeout(finish, 50);
    // Absolute failsafe
    const t2 = setTimeout(finish, 1200);

    let stop: (() => void) | undefined;
    (async () => {
      try {
        await initSupabaseFromStorage();
        await restoreAuthSession();
      } catch {
        /* local-only until user pastes keys */
      }
      if (!alive) return;
      stop = startAutoBootstrap();
    })();

    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      stop?.();
    };
  }, []);

  if (!bootDone || (!fontsLoaded && !fontWaitDone)) {
    return (
      <View style={[styles.boot, { backgroundColor: isDark ? '#0b0b14' : '#f4f4f8' }]}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.bootText}>Loading…</Text>
      </View>
    );
  }

  return <>{children}</>;
}

function AppInner() {
  const { isDark } = useTheme();
  return (
    <BootShell>
      <NavigationContainer>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <NotificationManager />
        <RootNavigator />
      </NavigationContainer>
    </BootShell>
  );
}

export default function App() {
  // Never call preventAutoHideAsync — that is what freezes the logo
  if (Platform.OS !== 'web') {
    SplashScreen.hideAsync().catch(() => {});
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppInner />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootText: {
    marginTop: 12,
    color: '#8b5cf6',
    fontSize: 14,
    fontWeight: '600',
  },
});
