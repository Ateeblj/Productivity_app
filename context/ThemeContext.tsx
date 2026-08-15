import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as syncedStorage from '../services/syncedStorage';

type ThemeContextValue = {
  isDark: boolean;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => {},
});

function applyNativeScheme(scheme: 'light' | 'dark') {
  try {
    // RN 0.72+ / web polyfill (utils/webThemePolyfill.ts)
    (Appearance as any).setColorScheme?.(scheme);
  } catch {
    /* ignore */
  }
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const root = document.documentElement;
    if (scheme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default from system; refined after AsyncStorage load
  const systemDark = Appearance.getColorScheme() === 'dark';
  const [isDark, setIsDark] = useState(systemDark);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('app_theme');
        // Plain string "dark" | "light" (not JSON-quoted)
        const theme =
          saved === 'dark' || saved === 'light'
            ? saved
            : saved === '"dark"'
              ? 'dark'
              : saved === '"light"'
                ? 'light'
                : null;
        if (!cancelled) {
          if (theme === 'dark') {
            setIsDark(true);
            applyNativeScheme('dark');
          } else if (theme === 'light') {
            setIsDark(false);
            applyNativeScheme('light');
          } else {
            applyNativeScheme(systemDark ? 'dark' : 'light');
          }
        }
      } catch (e) {
        console.warn('[theme] load failed, using system default', e);
        if (!cancelled) applyNativeScheme(systemDark ? 'dark' : 'light');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [systemDark]);

  const toggleTheme = useCallback(async () => {
    setIsDark((prev) => {
      const next = !prev;
      applyNativeScheme(next ? 'dark' : 'light');
      // Fire-and-forget persist
      syncedStorage.setItem('app_theme', next ? 'dark' : 'light').catch((e) => {
        console.warn('[theme] save failed', e);
      });
      return next;
    });
  }, []);

  // Avoid flash: still render children; isDark may update once after load
  void ready;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  return context || { isDark: false, toggleTheme: () => {} };
};
