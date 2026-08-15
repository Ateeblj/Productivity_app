// components/FolderCard.tsx — compact folder tiles (3–4 per row on phone)
import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Folder } from '../types';
import { useTheme } from '../context/ThemeContext';
import colors from '../utils/colors';
import AnimatedPressable from './AnimatedPressable';

interface FolderCardProps {
  folder: Folder;
  noteCount: number;
  subfolderCount?: number;
  totalItems?: number;
  onPress: (folder: Folder) => void;
  onLongPress?: (folder: Folder) => void;
  onDelete?: (folder: Folder) => void;
  style?: any;
  /** When true, card is sized for a horizontal strip (~3–4 visible). */
  compact?: boolean;
}

export default function FolderCard({
  folder,
  noteCount,
  subfolderCount = 0,
  totalItems,
  onPress,
  onLongPress,
  onDelete,
  style,
  compact = true,
}: FolderCardProps) {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;

  const items = totalItems ?? noteCount + subfolderCount;
  let meta = '';
  if (subfolderCount > 0 && noteCount > 0) {
    meta = `${noteCount}n · ${subfolderCount}f`;
  } else if (subfolderCount > 0) {
    meta = `${subfolderCount} folder${subfolderCount === 1 ? '' : 's'}`;
  } else if (noteCount > 0) {
    meta = `${noteCount} note${noteCount === 1 ? '' : 's'}`;
  } else {
    meta = 'Empty';
  }

  const accent = folder.color || palette.primary;

  return (
    <View style={[{ width: compact ? 108 : undefined, flex: compact ? undefined : 1, minWidth: compact ? 108 : 120 }, style]}>
      <AnimatedPressable
        onPress={() => onPress(folder)}
        onLongPress={() => onLongPress?.(folder)}
        style={[
          styles.card,
          compact && styles.cardCompact,
          {
            backgroundColor: isDark ? palette.card : '#FFFFFF',
            borderColor: isDark ? 'rgba(167,139,250,0.22)' : palette.border,
            ...Platform.select({
              ios: {
                shadowColor: isDark ? '#6446dc' : '#000',
                shadowOffset: { width: 0, height: compact ? 4 : 8 },
                shadowOpacity: isDark ? 0.35 : 0.08,
                shadowRadius: compact ? 8 : 14,
              },
              android: { elevation: compact ? 3 : 6 },
              default: {},
            }),
          },
        ]}
      >
        {isDark && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 8,
              right: 8,
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.1)',
            }}
          />
        )}

        {/* Color accent bar */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 10,
            bottom: 10,
            width: 3,
            borderRadius: 2,
            backgroundColor: accent,
          }}
        />

        {items > 0 && (
          <View
            style={{
              position: 'absolute',
              top: compact ? 8 : 10,
              right: compact ? 8 : 10,
              minWidth: compact ? 20 : 26,
              height: compact ? 20 : 26,
              borderRadius: compact ? 10 : 13,
              paddingHorizontal: 5,
              backgroundColor: isDark ? 'rgba(91,63,160,0.9)' : accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: compact ? 10 : 11, fontWeight: '800' }}>{items}</Text>
          </View>
        )}

        <View
          style={{
            width: compact ? 36 : 48,
            height: compact ? 36 : 48,
            borderRadius: 10,
            marginBottom: compact ? 8 : 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(240,180,41,0.16)' : 'rgba(240,180,41,0.12)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(240,180,41,0.35)' : 'rgba(240,180,41,0.25)',
          }}
        >
          <Text style={{ fontSize: compact ? 18 : 24 }}>📁</Text>
        </View>

        <Text
          style={{
            fontSize: compact ? 12 : 14,
            fontWeight: '700',
            color: isDark ? '#e8e8f0' : palette.text,
            paddingRight: items > 0 ? 18 : 0,
          }}
          numberOfLines={compact ? 1 : 2}
        >
          {folder.name}
        </Text>
        <Text
          style={{
            fontSize: compact ? 10 : 12,
            color: isDark ? 'rgba(232,232,240,0.4)' : palette.textMuted,
            marginTop: 3,
          }}
          numberOfLines={1}
        >
          {meta}
        </Text>

        {onDelete && !compact && (
          <TouchableOpacity
            onPress={() => onDelete(folder)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              position: 'absolute',
              bottom: 10,
              right: 10,
              width: 26,
              height: 26,
              borderRadius: 7,
              backgroundColor: isDark ? '#c0392b' : 'rgba(239,68,68,0.18)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: isDark ? '#fff' : '#EF4444', fontSize: 14, fontWeight: '800' }}>×</Text>
          </TouchableOpacity>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
    minHeight: 130,
    justifyContent: 'flex-start',
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
  },
  cardCompact: {
    borderRadius: 12,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    minHeight: 96,
  },
});
