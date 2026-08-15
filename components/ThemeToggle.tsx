// components/ThemeToggle.tsx
import React from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
}

export default function ThemeToggle({ showLabel = true }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(isDark ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: isDark ? 1 : 0,
      useNativeDriver: false,
      speed: 40,
      bounciness: 6,
    }).start();
  }, [isDark]);

  const toggleScale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <TouchableOpacity
        onPress={toggleTheme}
        style={{
          width: 56,
          height: 32,
          borderRadius: 16,
          backgroundColor: isDark ? '#6C4E9A' : '#E5E0EA',
          justifyContent: 'center',
          paddingHorizontal: 3,
        }}
      >
        <Animated.View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: '#FFFFFF',
            transform: [{ translateX: toggleScale }],
          }}
        />
      </TouchableOpacity>
      {showLabel && (
        <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#FFFFFF' : '#1A1620' }}>
          {isDark ? 'Dark' : 'Light'}
        </Text>
      )}
    </View>
  );
}