// components/PhaseBanner.tsx
// Shows current roadmap phase on Home / Daily / Weekly.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import colors from '../utils/colors';
import {
  getCurrentPhase,
  formatPhaseBanner,
  CurrentPhaseInfo,
} from '../services/roadmapImportService';

interface Props {
  /** Compact single line under a header */
  compact?: boolean;
  onPress?: () => void;
}

export default function PhaseBanner({ compact = true, onPress }: Props) {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const [info, setInfo] = useState<CurrentPhaseInfo | null>(null);

  const load = useCallback(async () => {
    try {
      const p = await getCurrentPhase();
      setInfo(p);
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const line = formatPhaseBanner(info);
  if (!line || !info) return null;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={{
        marginHorizontal: compact ? 0 : 16,
        marginTop: compact ? 8 : 12,
        marginBottom: compact ? 0 : 8,
        paddingHorizontal: 12,
        paddingVertical: compact ? 8 : 10,
        borderRadius: 10,
        backgroundColor: isDark ? 'rgba(155,127,212,0.18)' : 'rgba(108,78,154,0.12)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(155,127,212,0.35)' : 'rgba(108,78,154,0.25)',
      }}
    >
      <Text
        style={{
          fontSize: compact ? 12 : 13,
          fontWeight: '700',
          color: palette.primary,
          letterSpacing: 0.2,
        }}
        numberOfLines={2}
      >
        🎯 {line}
      </Text>
      {!compact && info.topics.length > 0 && (
        <Text
          style={{
            fontSize: 11,
            color: palette.textSecondary,
            marginTop: 4,
          }}
          numberOfLines={1}
        >
          {info.topics.slice(0, 3).join(' · ')}
          {info.topics.length > 3 ? '…' : ''}
        </Text>
      )}
    </TouchableOpacity>
  );
}
