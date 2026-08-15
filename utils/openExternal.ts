import { Linking, Platform } from 'react-native';

/**
 * Open http(s) links in the real system browser (Chrome etc.).
 * Never navigate inside the Electron/web shell.
 */
export function openExternal(url: string): void {
  if (!url || typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return;

  if (Platform.OS === 'web') {
    try {
      // Electron + browser: always new OS window/tab
      window.open(trimmed, '_blank', 'noopener,noreferrer');
    } catch {
      try {
        // @ts-ignore
        window.location.assign(trimmed);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  Linking.openURL(trimmed).catch(() => {});
}
