// components/TaskCard.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import colors from '../utils/colors';
import AnimatedPressable from './AnimatedPressable';

export type TaskCardProps = {
  title: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high' | string;
  time?: string;
  onPress?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
  accent?: string;
};

const PRIORITY: Record<string, string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#22C55E',
};

export default function TaskCard({
  title,
  completed,
  priority = 'medium',
  time,
  onPress,
  onToggle,
  onDelete,
  accent,
}: TaskCardProps) {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const bar = accent || PRIORITY[priority] || palette.primary;

  return (
    <AnimatedPressable
      onPress={onPress}
      contentStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isDark ? palette.card : '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: palette.border,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: 4, alignSelf: 'stretch', backgroundColor: bar, borderRadius: 2, marginRight: 10 }} />
      <AnimatedPressable
        onPress={onToggle}
        style={{ marginRight: 10 }}
        contentStyle={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: completed ? palette.success : palette.border,
          backgroundColor: completed ? palette.success : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {completed ? (
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
        ) : null}
      </AnimatedPressable>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: completed ? palette.textMuted : palette.text,
            textDecorationLine: completed ? 'line-through' : 'none',
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
        {!!time && (
          <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 2 }}>{time}</Text>
        )}
      </View>
      {onDelete ? (
        <AnimatedPressable onPress={onDelete} contentStyle={{ padding: 6 }}>
          <Text style={{ color: palette.textMuted, fontSize: 16 }}>×</Text>
        </AnimatedPressable>
      ) : null}
    </AnimatedPressable>
  );
}
