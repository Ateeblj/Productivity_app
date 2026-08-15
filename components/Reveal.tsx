// components/Reveal.tsx
// Fade-in + slide-up. Stagger by index. Always ends visible (never stuck at 0 opacity).
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  delay?: number;
  index?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Reveal({ children, delay = 0, index = 0, style }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    // Cap stagger so long lists don't wait forever
    const stagger = Math.min(index, 12) * 45;
    const d = delay + stagger;

    opacity.setValue(0);
    translateY.setValue(16);

    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        delay: d,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 90,
        delay: d,
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      // Safety: if interrupted, force visible
      if (!finished) {
        opacity.setValue(1);
        translateY.setValue(0);
      }
    });

    // Absolute safety timeout — never leave content invisible
    const safety = setTimeout(() => {
      opacity.setValue(1);
      translateY.setValue(0);
    }, d + 600);

    return () => {
      anim.stop();
      clearTimeout(safety);
    };
  }, [index, delay, opacity, translateY]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
