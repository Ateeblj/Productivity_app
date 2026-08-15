// Frosted glass card — depth + optional colored glow (iPhone / design system)
import React from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { mobile } from '../utils/mobileTheme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Accent glow color (e.g. roadmap primary) */
  glow?: string;
  padded?: boolean;
  radius?: number;
};

export default function GlassCard({
  children,
  style,
  glow,
  padded = true,
  radius = mobile.cardRadius,
}: Props) {
  const { isDark } = useTheme();

  return (
    <View
      style={[
        styles.base,
        {
          borderRadius: radius,
          backgroundColor: isDark ? mobile.surface : 'rgba(255,255,255,0.92)',
          borderColor: isDark ? mobile.border : 'rgba(0,0,0,0.06)',
          ...(glow
            ? Platform.select({
                ios: {
                  shadowColor: glow,
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.35,
                  shadowRadius: 24,
                },
                android: { elevation: 10 },
                default: {},
              })
            : Platform.select({
                ios: {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: isDark ? 0.45 : 0.08,
                  shadowRadius: 20,
                },
                android: { elevation: isDark ? 8 : 3 },
                default: {},
              })),
        },
        padded && { padding: 16 },
        style,
      ]}
    >
      {glow ? (
        <View
          pointerEvents="none"
          style={[
            styles.orb,
            {
              backgroundColor: glow,
              opacity: isDark ? 0.12 : 0.08,
            },
          ]}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  orb: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
});
