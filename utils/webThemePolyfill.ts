// utils/webThemePolyfill.ts
import { Platform, Appearance } from 'react-native';

if (Platform.OS === 'web') {
  // Polyfill for Appearance.setColorScheme on web
  (Appearance as any).setColorScheme = (scheme: 'light' | 'dark') => {
    const root = document.documentElement;
    if (scheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };
}