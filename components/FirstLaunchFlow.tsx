// components/FirstLaunchFlow.tsx
// Lightweight first-launch sequence (shown once). Not a full onboarding framework.
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import colors from '../utils/colors';
import AnimatedPressable from './AnimatedPressable';
import { generateThisWeek } from '../services/roadmapImportService';
import { getActiveGoal, getLearningUnits, sortUnitsForScheduling } from '../services/goalsService';

export const FIRST_LAUNCH_DONE_KEY = '__first_launch_flow_v1__';
export const FIRST_LAUNCH_DRAFT_KEY = '__first_launch_draft__';

type Step =
  | 'goal'
  | 'time'
  | 'generate'
  | 'plan'
  | 'week'
  | 'start';

interface Props {
  visible: boolean;
  onDone: () => void;
  onNavigate: (route: string) => void;
}

export default function FirstLaunchFlow({ visible, onDone, onNavigate }: Props) {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;

  const [step, setStep] = useState<Step>('goal');
  const [goal, setGoal] = useState('');
  const [hours, setHours] = useState('2');
  const [busy, setBusy] = useState(false);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const [weekMsg, setWeekMsg] = useState<string | null>(null);
  const [firstTaskTitle, setFirstTaskTitle] = useState<string | null>(null);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(FIRST_LAUNCH_DONE_KEY, '1');
    } catch { /* ignore */ }
    onDone();
  };

  const skip = () => {
    finish();
  };

  const saveDraftAndGoGenerate = async () => {
    const hpd = Math.max(0.5, parseFloat(hours) || 2);
    try {
      await AsyncStorage.setItem(
        FIRST_LAUNCH_DRAFT_KEY,
        JSON.stringify({
          goal: goal.trim(),
          hoursPerDay: String(hpd),
          fromFirstLaunch: true,
        }),
      );
    } catch { /* ignore */ }
    setStep('generate');
  };

  const openRoadmapAI = () => {
    onNavigate('RoadmapAI');
  };

  const refreshPlanStep = async () => {
    setBusy(true);
    try {
      const g = await getActiveGoal();
      if (g) {
        setPlanTitle(g.title || g.summary || 'Your roadmap');
        setStep('plan');
      } else {
        setPlanTitle(null);
        setStep('generate');
      }
    } catch {
      setStep('generate');
    } finally {
      setBusy(false);
    }
  };

  const runGenerateWeek = async () => {
    setBusy(true);
    setWeekMsg(null);
    try {
      const result = await generateThisWeek({ maxItems: 8, clearPreviousRoadmap: true });
      setWeekMsg(
        result.added
          ? `Scheduled ${result.added} session(s) from “${result.phaseName}”.`
          : result.messages?.[0] || 'Nothing new to schedule — you can pack later from Home.',
      );
      setStep('week');
    } catch (e: any) {
      setWeekMsg(e?.message || 'Could not schedule this week.');
      setStep('week');
    } finally {
      setBusy(false);
    }
  };

  const prepareStartTask = async () => {
    setBusy(true);
    try {
      const g = await getActiveGoal();
      if (g) {
        const units = await getLearningUnits(g.id);
        const sorted = sortUnitsForScheduling(units);
        const next = sorted.find((u) => u.state !== 'mastered');
        setFirstTaskTitle(next?.name || null);
      }
      setStep('start');
    } catch {
      setStep('start');
    } finally {
      setBusy(false);
    }
  };

  const startToday = async () => {
    await finish();
    onNavigate('Daily');
  };

  const card = {
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: palette.border,
  };

  const primaryBtn = (disabled?: boolean) => ({
    backgroundColor: palette.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    opacity: disabled ? 0.55 : 1,
    marginTop: 12,
  });

  const secondaryBtn = {
    paddingVertical: 12,
    alignItems: 'center' as const,
    marginTop: 8,
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View
        style={{
          flex: 1,
          backgroundColor: isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,15,20,0.45)',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <View style={[card, { maxHeight: '90%' }]}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 12, fontWeight: '700', color: palette.textMuted, letterSpacing: 0.6 }}>
              FIRST RUN
            </Text>

            {step === 'goal' && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, marginTop: 8 }}>
                  What do you want to achieve?
                </Text>
                <Text style={{ fontSize: 14, color: palette.textSecondary, marginTop: 8, lineHeight: 20 }}>
                  One clear outcome. You can refine it later.
                </Text>
                <TextInput
                  value={goal}
                  onChangeText={setGoal}
                  placeholder="e.g. Operating systems foundation"
                  placeholderTextColor={palette.placeholder}
                  multiline
                  style={{
                    marginTop: 16,
                    minHeight: 88,
                    borderRadius: 12,
                    padding: 14,
                    backgroundColor: palette.inputBackground,
                    color: palette.text,
                    fontSize: 15,
                    textAlignVertical: 'top',
                  }}
                />
                <AnimatedPressable
                  onPress={() => goal.trim() && setStep('time')}
                  disabled={!goal.trim()}
                  style={primaryBtn(!goal.trim())}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continue</Text>
                </AnimatedPressable>
              </>
            )}

            {step === 'time' && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, marginTop: 8 }}>
                  How much time can you give daily?
                </Text>
                <Text style={{ fontSize: 14, color: palette.textSecondary, marginTop: 8, lineHeight: 20 }}>
                  Honest estimate in hours — used to size your plan.
                </Text>
                <TextInput
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="decimal-pad"
                  placeholder="2"
                  placeholderTextColor={palette.placeholder}
                  style={{
                    marginTop: 16,
                    borderRadius: 12,
                    padding: 14,
                    backgroundColor: palette.inputBackground,
                    color: palette.text,
                    fontSize: 18,
                    fontWeight: '700',
                  }}
                />
                <AnimatedPressable onPress={saveDraftAndGoGenerate} style={primaryBtn()}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continue</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={() => setStep('goal')} style={secondaryBtn}>
                  <Text style={{ color: palette.textMuted, fontWeight: '600' }}>Back</Text>
                </AnimatedPressable>
              </>
            )}

            {step === 'generate' && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, marginTop: 8 }}>
                  Generate your roadmap
                </Text>
                <Text style={{ fontSize: 14, color: palette.textSecondary, marginTop: 8, lineHeight: 20 }}>
                  Your goal and daily time are ready. Open Generate roadmap to create phases and Learning Units
                  (AI key or paste JSON). Come back here when it is saved.
                </Text>
                <View
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: palette.primarySurface,
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>{goal}</Text>
                  <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>
                    ~{hours || '2'} h/day
                  </Text>
                </View>
                <AnimatedPressable onPress={openRoadmapAI} style={primaryBtn()}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Open Generate roadmap</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={refreshPlanStep} disabled={busy} style={primaryBtn(busy)}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>I’ve generated it — continue</Text>
                  )}
                </AnimatedPressable>
                <AnimatedPressable onPress={() => setStep('time')} style={secondaryBtn}>
                  <Text style={{ color: palette.textMuted, fontWeight: '600' }}>Back</Text>
                </AnimatedPressable>
              </>
            )}

            {step === 'plan' && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, marginTop: 8 }}>
                  Here’s your plan
                </Text>
                <Text style={{ fontSize: 14, color: palette.textSecondary, marginTop: 8, lineHeight: 20 }}>
                  Roadmap is saved. Next, schedule this week’s work from the current phase.
                </Text>
                <View
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(167,139,250,0.12)' : palette.primarySurface,
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>
                    {planTitle || 'Active roadmap'}
                  </Text>
                  <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: 4 }}>
                    Open Roadmaps anytime for phases and Learning Units.
                  </Text>
                </View>
                <AnimatedPressable onPress={runGenerateWeek} disabled={busy} style={primaryBtn(busy)}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Generate this week</Text>
                  )}
                </AnimatedPressable>
              </>
            )}

            {step === 'week' && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, marginTop: 8 }}>
                  This week is set
                </Text>
                <Text style={{ fontSize: 14, color: palette.textSecondary, marginTop: 8, lineHeight: 20 }}>
                  {weekMsg || 'Weekly sessions are ready on the board.'}
                </Text>
                <AnimatedPressable onPress={prepareStartTask} disabled={busy} style={primaryBtn(busy)}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continue</Text>
                  )}
                </AnimatedPressable>
              </>
            )}

            {step === 'start' && (
              <>
                <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text, marginTop: 8 }}>
                  Start today’s first task
                </Text>
                <Text style={{ fontSize: 14, color: palette.textSecondary, marginTop: 8, lineHeight: 20 }}>
                  {firstTaskTitle
                    ? `Suggested focus: “${firstTaskTitle}”. Open Today to check off work and habits.`
                    : 'Open Today to work your checklist. Habits and tasks live there.'}
                </Text>
                <AnimatedPressable onPress={startToday} style={primaryBtn()}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Go to Today</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={finish} style={secondaryBtn}>
                  <Text style={{ color: palette.textMuted, fontWeight: '600' }}>Finish on Home</Text>
                </AnimatedPressable>
              </>
            )}

            <AnimatedPressable onPress={skip} style={{ marginTop: 18, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>Skip for now</Text>
            </AnimatedPressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
