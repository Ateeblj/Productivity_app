// components/NoteCard.tsx — glass cards matching Enhance Design Notes tab
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Note } from '../types';
import colors from '../utils/colors';

interface NoteCardProps {
  note: Note;
  onPress: (note: Note) => void;
  onDelete?: (noteId: string) => void;
  onTogglePin?: (note: Note) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (noteId: string) => void;
  accentColor?: string;
}

function formatDuration(sec?: number): string {
  if (sec == null || !Number.isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NoteCard({
  note,
  onPress,
  onDelete,
  onTogglePin,
  selectable = false,
  selected = false,
  onToggleSelect,
  accentColor,
}: NoteCardProps) {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const [menuOpen, setMenuOpen] = useState(false);

  const isVoice = note.type === 'voice';
  const isVideo = note.type === 'video';
  const typeLabel = isVoice ? 'Audio' : isVideo ? 'Video' : 'Note';

  const accent =
    accentColor ||
    (isVoice ? '#34d399' : isVideo ? '#f97316' : palette.primary);

  const requestDelete = () => {
    setMenuOpen(false);
    if (!onDelete) return;
    const run = () => onDelete(note.id);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Delete this note permanently?')) run();
    } else {
      Alert.alert('Delete Note', 'Delete this note permanently?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
    }
  };

  const onCardPress = () => {
    if (selectable) {
      onToggleSelect?.(note.id);
      return;
    }
    onPress(note);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onCardPress}
        onLongPress={() => {
          if (selectable) onToggleSelect?.(note.id);
          else setMenuOpen(true);
        }}
        delayLongPress={350}
        style={[
          styles.card,
          {
            backgroundColor: selected
              ? isDark
                ? `${accent}18`
                : palette.primarySurface
              : isDark
                ? 'rgba(255,255,255,0.04)'
                : palette.card,
            borderColor: selected
              ? accent
              : isDark
                ? 'rgba(255,255,255,0.09)'
                : palette.border,
            borderWidth: selected ? 1.5 : 1,
            ...Platform.select({
              ios: {
                shadowColor: isDark ? accent : '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: isDark ? 0.35 : 0.08,
                shadowRadius: 16,
              },
              android: { elevation: isDark ? 5 : 2 },
              default: {},
            }),
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 18,
            right: 18,
            height: 2,
            borderRadius: 1,
            backgroundColor: accent,
            opacity: 0.55,
          }}
        />
        {isDark && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 16,
              backgroundColor: accent,
              opacity: 0.07,
            }}
          />
        )}

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {selectable ? (
            <TouchableOpacity
              onPress={() => onToggleSelect?.(note.id)}
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: selected ? accent : palette.border,
                backgroundColor: selected ? accent : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
                marginTop: 2,
              }}
            >
              {selected ? (
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>✓</Text>
              ) : null}
            </TouchableOpacity>
          ) : null}

          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: isDark ? `${accent}20` : `${accent}15`,
                    borderWidth: 1,
                    borderColor: isDark ? `${accent}40` : `${accent}30`,
                  }}
                >
                  <Text style={{ fontSize: 10, marginRight: 4 }}>
                    {isVoice ? '🎙' : isVideo ? '🎬' : '📝'}
                  </Text>
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '800',
                      letterSpacing: 0.9,
                      textTransform: 'uppercase',
                      color: accent,
                    }}
                  >
                    {typeLabel}
                  </Text>
                </View>
                {note.isPinned ? (
                  <Text style={{ fontSize: 10, color: accent, opacity: 0.8 }}>📌</Text>
                ) : null}
              </View>
              {!!note.updatedAt && (
                <Text
                  style={{
                    fontSize: 10,
                    color: isDark ? 'rgba(255,255,255,0.28)' : palette.textMuted,
                  }}
                >
                  {new Date(note.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              )}
            </View>

            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: isDark ? 'rgba(255,255,255,0.92)' : palette.text,
                lineHeight: 21,
              }}
              numberOfLines={2}
            >
              {note.title || 'Untitled'}
            </Text>

            {!!note.content && !isVoice && !isVideo && (
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? 'rgba(255,255,255,0.38)' : palette.textSecondary,
                  marginTop: 6,
                  lineHeight: 17,
                }}
                numberOfLines={2}
              >
                {note.content}
              </Text>
            )}

            {isVoice && (
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 18 }}>
                  {[4, 8, 12, 6, 14, 9, 5, 11, 7, 13, 6, 10, 4, 9, 12, 7, 5, 10].map((h, i) => (
                    <View
                      key={i}
                      style={{
                        width: 3,
                        height: h,
                        borderRadius: 2,
                        marginRight: 2,
                        backgroundColor: isDark ? `${accent}70` : `${accent}55`,
                      }}
                    />
                  ))}
                </View>
                {!!note.duration && (
                  <Text
                    style={{
                      fontSize: 10,
                      marginTop: 6,
                      color: isDark ? 'rgba(255,255,255,0.35)' : palette.textMuted,
                      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                    }}
                  >
                    {formatDuration(note.duration)}
                  </Text>
                )}
              </View>
            )}

            {isVideo && (
              <View
                style={{
                  marginTop: 10,
                  height: 68,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: isDark ? `${accent}30` : `${accent}25`,
                  backgroundColor: isDark ? `${accent}12` : `${accent}10`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: isDark ? `${accent}35` : `${accent}28`,
                    borderWidth: 1,
                    borderColor: isDark ? `${accent}55` : `${accent}40`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: accent, fontSize: 12, marginLeft: 2 }}>▶</Text>
                </View>
                {!!note.duration && (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 6,
                      right: 8,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: 'rgba(0,0,0,0.65)',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>
                      {formatDuration(note.duration)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {!!note.tags?.length && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                {note.tags.slice(0, 4).map((tag) => (
                  <View
                    key={tag}
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 5,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '600',
                        color: isDark ? 'rgba(255,255,255,0.35)' : palette.textMuted,
                      }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {!selectable ? (
            <TouchableOpacity
              onPress={requestDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                marginLeft: 6,
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#f87171', fontSize: 16, fontWeight: '800' }}>×</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
          onPress={() => setMenuOpen(false)}
        >
          <View
            style={{
              backgroundColor: isDark ? '#16161f' : palette.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : palette.border,
              overflow: 'hidden',
            }}
          >
            <Text
              style={{
                padding: 16,
                fontSize: 13,
                fontWeight: '700',
                color: isDark ? 'rgba(255,255,255,0.4)' : palette.textMuted,
              }}
              numberOfLines={1}
            >
              {note.title || 'Note'}
            </Text>
            {onTogglePin ? (
              <TouchableOpacity
                onPress={() => {
                  setMenuOpen(false);
                  onTogglePin(note);
                }}
                style={styles.menuRow}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>
                  {note.isPinned ? 'Unpin' : 'Pin'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={requestDelete} style={styles.menuRow}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#EF4444' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuOpen(false)} style={styles.menuRow}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: palette.textMuted }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    overflow: 'hidden',
    minHeight: 96,
    width: '100%',
    alignSelf: 'stretch',
  },
  menuRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.22)',
  },
});
