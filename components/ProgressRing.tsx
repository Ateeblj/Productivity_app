import React from 'react';
import { View, Text } from 'react-native';

/**
 * Simple progress badge (no react-native-svg dependency).
 * Shows percent inside a circular track tinted by progress.
 */
type Props = {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  labelColor?: string;
};

export default function ProgressRing({
  value,
  size = 52,
  stroke = 4,
  color = '#8B5CF6',
  trackColor = 'rgba(255,255,255,0.07)',
  labelColor = '#F0EFFF',
}: Props) {
  const v = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: stroke,
        borderColor: trackColor,
        alignItems: 'center',
        justifyContent: 'center',
        // Progress “fill” illusion: thicker colored arc side via dual border
        borderTopColor: v > 0 ? color : trackColor,
        borderRightColor: v >= 25 ? color : trackColor,
        borderBottomColor: v >= 50 ? color : trackColor,
        borderLeftColor: v >= 75 ? color : trackColor,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: labelColor }}>{v}%</Text>
    </View>
  );
}
