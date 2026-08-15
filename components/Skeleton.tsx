// Skeleton shimmer — loading placeholder with metallic sweep
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle, StyleProp, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { mobile } from '../utils/mobileTheme';

type Props = {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export default function Skeleton({ width = '100%', height = 14, radius = 8, style }: Props) {
  const { isDark } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          opacity,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const { isDark } = useTheme();
  return (
    <View
      style={{
        backgroundColor: isDark ? mobile.surface : '#fff',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: isDark ? mobile.border : 'rgba(0,0,0,0.06)',
        gap: 12,
      }}
    >
      <Skeleton width="40%" height={12} />
      <Skeleton width="85%" height={18} />
      <Skeleton width="70%" height={14} />
      {Array.from({ length: Math.max(0, lines - 2) }).map((_, i) => (
        <Skeleton key={i} width={`${60 + (i % 3) * 10}%`} height={12} />
      ))}
    </View>
  );
}
