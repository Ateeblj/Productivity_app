import React from 'react';
import { Text, Platform, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const EMOJI: Record<string, string> = {
  home: '🏠',
  'home-outline': '🏠',
  'document-text': '📄',
  'document-text-outline': '📄',
  checkbox: '☑',
  'checkbox-outline': '☐',
  grid: '▦',
  'grid-outline': '▦',
  map: '🗺',
  'map-outline': '🗺',
  calendar: '📅',
  'calendar-outline': '📅',
  'calendar-number-outline': '📅',
  'stats-chart': '📊',
  'stats-chart-outline': '📊',
  sparkles: '✨',
  'sparkles-outline': '✨',
  search: '🔍',
  'search-outline': '🔍',
  settings: '⚙',
  'settings-outline': '⚙',
  menu: '☰',
  close: '✕',
  add: '+',
  'chevron-back': '‹',
  'chevron-forward': '›',
  'chevron-up': '⌃',
  'chevron-down': '⌄',
  person: '👤',
  'person-outline': '👤',
};

type Props = {
  name: string;
  size?: number;
  color?: string;
  style?: object;
};

/**
 * Icons that work in Expo Go, release APK, and Electron.
 * Uses Ionicons when the font is available; emoji otherwise (never empty boxes).
 */
export default function AppIcon({ name, size = 22, color = '#fff', style }: Props) {
  // Electron packaged web sometimes fails to load the icon font → empty squares.
  // Prefer emoji there so the sidebar always looks intentional.
  const forceEmoji = Platform.OS === 'web';

  if (!forceEmoji) {
    return (
      <Ionicons
        name={name as keyof typeof Ionicons.glyphMap}
        size={size}
        color={color}
        style={style as any}
      />
    );
  }

  const emoji = EMOJI[name] || '•';
  return (
    <Text
      style={[
        {
          fontSize: Math.round(size * 0.85),
          color,
          lineHeight: size,
          width: size,
          textAlign: 'center',
        },
        style as any,
      ]}
    >
      {emoji}
    </Text>
  );
}
