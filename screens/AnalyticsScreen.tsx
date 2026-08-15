// screens/AnalyticsScreen.tsx
// Insight: week completion, mastery by goal, best weekday, text summary.
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import colors from '../utils/colors';
import AnimatedPressable from '../components/AnimatedPressable';
import {
  getAnalyticsSnapshot,
  buildWeeklySummaryText,
  AnalyticsSnapshot,
} from '../services/analyticsService';

export default function AnalyticsScreen() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const navigation = useNavigation<any>();

  const [snap, setSnap] = useState<AnalyticsSnapshot | null>(null);
  const [summary, setSummary] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const load = useCallback(async () => {
    const s = await getAnalyticsSnapshot();
    setSnap(s);
    setSummary(await buildWeeklySummaryText(s));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shareSummary = async () => {
    const text = summary || (await buildWeeklySummaryText());
    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && (navigator as any).clipboard?.writeText) {
          await (navigator as any).clipboard.writeText(text);
          Alert.alert('Copied', 'Weekly summary copied to clipboard.');
        } else {
          Alert.alert('Summary', text);
        }
      } else {
        await Share.share({ message: text });
      }
    } catch {
      Alert.alert('Summary', text);
    }
  };

  const maxBar = Math.max(
    1,
    ...(snap?.weekDays.map((d) => d.total) || [1]),
    ...(snap?.weekdayRanks.map((d) => d.score) || [1]),
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.background }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.primary} />
      }
    >
      <Text style={{ fontSize: 24, fontWeight: '700', color: palette.text }}>Analytics</Text>
      <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 4, marginBottom: 20 }}>
        Insight from Goals + Daily + Weekly · pull to refresh
      </Text>

      {/* Week overview cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {[
          {
            label: 'This week',
            value: snap ? `${snap.weekPercent}%` : '—',
            sub: snap ? `${snap.weekCompleted}/${snap.weekTotal} done` : 'Loading…',
            color: palette.primary,
          },
          {
            label: 'Best day',
            value: snap?.mostProductive?.short || '—',
            sub: snap?.mostProductive
              ? `${snap.mostProductive.score} completions`
              : 'Complete tasks to rank',
            color: palette.success,
          },
          {
            label: 'Goals',
            value: String(snap?.goalMastery.length ?? 0),
            sub: 'Active curricula',
            color: palette.info,
          },
        ].map((c) => (
          <View
            key={c.label}
            style={{
              flexGrow: 1,
              minWidth: 100,
              backgroundColor: palette.card,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <Text style={{ fontSize: 11, color: palette.textMuted, marginBottom: 6 }}>{c.label}</Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: c.color }}>{c.value}</Text>
            <Text style={{ fontSize: 11, color: palette.textSecondary, marginTop: 4 }}>{c.sub}</Text>
          </View>
        ))}
      </View>

      {/* Week completion chart */}
      <Section title="Week completion" palette={palette}>
        <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 12 }}>
          Weekly board + daily habits this week
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 }}>
          {(snap?.weekDays || []).map((d) => {
            const h = d.total === 0 ? 4 : Math.max(8, (d.percent / 100) * 120);
            return (
              <View key={d.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                <Text style={{ fontSize: 10, color: palette.textMuted, marginBottom: 4 }}>
                  {d.total ? `${d.percent}%` : '—'}
                </Text>
                <View
                  style={{
                    width: '100%',
                    maxWidth: 36,
                    height: h,
                    borderRadius: 6,
                    backgroundColor:
                      d.percent >= 70
                        ? palette.success
                        : d.percent >= 40
                          ? palette.warning
                          : d.total
                            ? palette.primary
                            : palette.border,
                    opacity: d.total ? 1 : 0.45,
                  }}
                />
                <Text style={{ fontSize: 11, color: palette.textSecondary, marginTop: 6 }}>
                  {d.short}
                </Text>
              </View>
            );
          })}
        </View>
        {snap && snap.weekTotal === 0 && (
          <EmptyHint
            palette={palette}
            text="No weekly items yet. Generate this week from Roadmap AI."
            actionLabel="Open Roadmap AI"
            onPress={() => navigation.navigate('RoadmapAI')}
          />
        )}
      </Section>

      {/* Mastery per goal */}
      <Section title="Mastery by goal" palette={palette}>
        {(snap?.goalMastery || []).length === 0 ? (
          <EmptyHint
            palette={palette}
            text="No goals yet. Create a roadmap to track unit mastery."
            actionLabel="Open Goals"
            onPress={() => navigation.navigate('Roadmaps')}
          />
        ) : (
          (snap?.goalMastery || []).map((g) => (
            <View
              key={g.goalId}
              style={{
                marginBottom: 12,
                padding: 12,
                backgroundColor: palette.inputBackground,
                borderRadius: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text
                  style={{ flex: 1, fontSize: 14, fontWeight: '600', color: palette.text }}
                  numberOfLines={1}
                >
                  {g.title}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: palette.primary }}>
                  {g.summary.masteryPercent}%
                </Text>
              </View>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: palette.border,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, g.summary.masteryPercent)}%`,
                    backgroundColor: palette.success,
                    borderRadius: 4,
                  }}
                />
              </View>
              <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 6 }}>
                {g.summary.mastered}/{g.summary.total} mastered
                {g.summary.inProgress ? ` · ${g.summary.inProgress} in progress` : ''}
                {g.summary.needsRevision ? ` · ${g.summary.needsRevision} revision` : ''}
              </Text>
            </View>
          ))
        )}
      </Section>

      {/* Most productive weekday */}
      <Section title="Most productive weekday" palette={palette}>
        <Text style={{ fontSize: 12, color: palette.textMuted, marginBottom: 12 }}>
          Ranked by completed weekly + daily items
        </Text>
        {(snap?.weekdayRanks || []).map((d, i) => {
          const widthPct = maxBar ? Math.round((d.score / maxBar) * 100) : 0;
          return (
            <View key={d.day} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ width: 36, fontSize: 12, color: palette.textSecondary }}>{d.short}</Text>
              <View
                style={{
                  flex: 1,
                  height: 18,
                  borderRadius: 6,
                  backgroundColor: palette.border,
                  overflow: 'hidden',
                  marginRight: 8,
                }}
              >
                <View
                  style={{
                    height: '100%',
                    width: `${Math.max(d.score ? 6 : 0, widthPct)}%`,
                    backgroundColor: i === 0 && d.score > 0 ? palette.success : palette.primary,
                    borderRadius: 6,
                    opacity: d.score ? 1 : 0.25,
                  }}
                />
              </View>
              <Text style={{ width: 28, fontSize: 12, fontWeight: '600', color: palette.text, textAlign: 'right' }}>
                {d.score}
              </Text>
            </View>
          );
        })}
        {snap?.mostProductive && snap.mostProductive.score > 0 && (
          <Text style={{ fontSize: 13, color: palette.text, marginTop: 8, fontWeight: '600' }}>
            You get the most done on {snap.mostProductive.day}s.
          </Text>
        )}
      </Section>

      {/* Weekly summary */}
      <Section title="Weekly summary" palette={palette}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <AnimatedPressable
            onPress={() => setShowSummary((v) => !v)}
            style={{
              backgroundColor: palette.primary,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
              {showSummary ? 'Hide summary' : 'Generate summary'}
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            onPress={shareSummary}
            style={{
              backgroundColor: palette.surface,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: palette.primary,
            }}
          >
            <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>
              {Platform.OS === 'web' ? 'Copy' : 'Share'}
            </Text>
          </AnimatedPressable>
        </View>
        {showSummary && (
          <View
            style={{
              backgroundColor: palette.inputBackground,
              borderRadius: 10,
              padding: 14,
              borderWidth: 1,
              borderColor: palette.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: palette.text,
                lineHeight: 20,
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
              }}
            >
              {summary || 'No data yet.'}
            </Text>
          </View>
        )}
      </Section>

      <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 8, lineHeight: 16 }}>
        Analytics only reads your Goals, Daily, and Weekly data. It never changes your plan.
      </Text>
    </ScrollView>
  );
}

function Section({
  title,
  children,
  palette,
}: {
  title: string;
  children: React.ReactNode;
  palette: any;
}) {
  return (
    <View
      style={{
        backgroundColor: palette.card,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text, marginBottom: 4 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function EmptyHint({
  palette,
  text,
  actionLabel,
  onPress,
}: {
  palette: any;
  text: string;
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <View style={{ paddingVertical: 8 }}>
      <Text style={{ fontSize: 13, color: palette.textMuted, marginBottom: 10, lineHeight: 18 }}>
        {text}
      </Text>
      <AnimatedPressable onPress={onPress}>
        <Text style={{ color: palette.primary, fontWeight: '700', fontSize: 13 }}>{actionLabel}</Text>
      </AnimatedPressable>
    </View>
  );
}
