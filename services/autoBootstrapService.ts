// services/autoBootstrapService.ts
// Automatic cloud sync on login/foreground.
// Weekly pack is OPT-IN (default OFF). Manual "Generate this week" is the default path.
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser, subscribeToAuthChanges } from './authService';
import { pullAndMerge } from './syncedStorage';
import { generateThisWeek, getRoadmapState } from './roadmapImportService';
import { isSupabaseConfigured } from './supabaseClient';

const LAST_AUTO_SYNC_KEY = '__auto_last_sync_at__';
const LAST_AUTO_WEEK_KEY = '__auto_last_week_pack__';
/** User preference: auto pack week on login/foreground. Default OFF. */
export const AUTO_PACK_ENABLED_KEY = 'auto_pack_week_enabled';
/** One-line heads-up shown once after this behavior change ships. */
export const AUTO_PACK_NOTICE_KEY = '__auto_pack_optin_notice_v1__';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes while app is active
const MIN_SYNC_GAP_MS = 30 * 1000; // don't thrash on rapid foreground

let started = false;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let authUnsub: (() => void) | null = null;
let runningSync = false;
let runningWeek = false;

function weekKey(d = new Date()): string {
  // Monday-based week id YYYY-MM-DD of week start
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(12, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

async function countRoadmapWeekItems(): Promise<number> {
  try {
    const { countRoadmapWeekActions } = await import('./actionsService');
    return await countRoadmapWeekActions();
  } catch {
    return 0;
  }
}

/**
 * Quiet cloud sync. Safe to call often — debounced by MIN_SYNC_GAP_MS
 * and a running lock. No-ops if signed out or Supabase not configured.
 */
export async function autoSync(reason: string = 'manual'): Promise<{ ok: boolean; detail?: string }> {
  if (runningSync) return { ok: false, detail: 'busy' };
  const user = getCurrentUser();
  if (!user) return { ok: false, detail: 'signed-out' };
  if (!isSupabaseConfigured) return { ok: false, detail: 'not-configured' };

  try {
    const last = await AsyncStorage.getItem(LAST_AUTO_SYNC_KEY);
    if (last && reason !== 'login' && reason !== 'manual') {
      const gap = Date.now() - new Date(last).getTime();
      if (gap < MIN_SYNC_GAP_MS) return { ok: false, detail: 'throttled' };
    }
  } catch {
    /* ignore */
  }

  runningSync = true;
  try {
    const result = await pullAndMerge();
    await AsyncStorage.setItem(LAST_AUTO_SYNC_KEY, new Date().toISOString());
    console.log(
      `[auto] sync (${reason}) pulled=${result.pulled.length} pushed=${result.pushed.length}`,
    );
    return { ok: true, detail: `pulled ${result.pulled.length}, pushed ${result.pushed.length}` };
  } catch (e: any) {
    console.warn('[auto] sync failed', e?.message || e);
    return { ok: false, detail: e?.message || String(e) };
  } finally {
    runningSync = false;
  }
}

/**
 * Ensure the current week has roadmap sessions packed.
 * Runs when: new calendar week, or board is empty of roadmap items.
 * Does not wipe user-added weekly tasks (generateThisWeek only clears roadmap-tagged rows).
 */
export async function getAutoPackEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(AUTO_PACK_ENABLED_KEY);
    // Default OFF — missing key means disabled
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export async function setAutoPackEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_PACK_ENABLED_KEY, enabled ? '1' : '0');
}

/**
 * One-line notice for existing users after auto-pack default changed to OFF.
 * Returns the message once, then never again.
 */
export async function consumeAutoPackOptInNotice(): Promise<string | null> {
  try {
    const shown = await AsyncStorage.getItem(AUTO_PACK_NOTICE_KEY);
    if (shown === '1') return null;
    await AsyncStorage.setItem(AUTO_PACK_NOTICE_KEY, '1');
    return (
      'Auto “Generate this week” on open is now off by default. ' +
      'Use Generate this week when you want to pack — or turn Auto-pack on in Profile.'
    );
  } catch {
    return null;
  }
}

export async function autoPackWeek(reason: string = 'open'): Promise<{ ok: boolean; detail?: string }> {
  // Opt-in gate (item 10): default OFF
  const enabled = await getAutoPackEnabled();
  if (!enabled) {
    return { ok: false, detail: 'auto-pack-disabled' };
  }
  if (runningWeek) return { ok: false, detail: 'busy' };
  runningWeek = true;
  try {
    const state = await getRoadmapState();
    if (!state?.plan?.milestones?.length) {
      return { ok: false, detail: 'no-roadmap' };
    }

    const wk = weekKey();
    const lastPack = await AsyncStorage.getItem(LAST_AUTO_WEEK_KEY);
    const roadmapCount = await countRoadmapWeekItems();

    // Skip if we already packed this calendar week and board still has items
    if (lastPack === wk && roadmapCount > 0) {
      return { ok: true, detail: 'already-packed' };
    }

    // If board has items for this week key from a previous partial run, still
    // allow generateThisWeek — it merges by title and clears only roadmap tags.
    const result = await generateThisWeek({
      maxItems: 8,
      clearPreviousRoadmap: true,
    });
    await AsyncStorage.setItem(LAST_AUTO_WEEK_KEY, wk);
    if (result.added > 0) {
      await AsyncStorage.setItem(
        '__auto_pack_notice__',
        `Scheduled ${result.added} session(s) for “${result.phaseName}”. Open Weekly to review.`,
      );
    }
    console.log(`[auto] week pack (${reason}) added=${result.added} phase=${result.phaseName}`);
    return {
      ok: true,
      detail: result.added
        ? `scheduled ${result.added} for “${result.phaseName}”`
        : result.messages?.[0] || 'no new items',
    };
  } catch (e: any) {
    console.warn('[auto] week pack failed', e?.message || e);
    return { ok: false, detail: e?.message || String(e) };
  } finally {
    runningWeek = false;
  }
}

/** Full boot sequence: sync first; weekly pack only if user opted in. */
export async function runAutoBootstrap(reason: string = 'open'): Promise<void> {
  await autoSync(reason);
  // autoPackWeek is a no-op when preference is OFF (default)
  await autoPackWeek(reason);
}

function clearSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

function startSyncTimer() {
  clearSyncTimer();
  syncTimer = setInterval(() => {
    if (getCurrentUser()) {
      autoSync('interval');
    }
  }, SYNC_INTERVAL_MS);
}

/**
 * Call once from App root. Hooks auth + app foreground.
 * Idempotent.
 */
export function startAutoBootstrap(): () => void {
  if (started) {
    return () => {};
  }
  started = true;

  // On auth ready / login / logout
  authUnsub = subscribeToAuthChanges((user, hydrated) => {
    if (!hydrated) return;
    if (user) {
      runAutoBootstrap('login').catch(() => {});
      startSyncTimer();
    } else {
      clearSyncTimer();
    }
  });

  // Foreground resume
  const onAppState = (next: AppStateStatus) => {
    if (next === 'active' && getCurrentUser()) {
      runAutoBootstrap('foreground').catch(() => {});
      startSyncTimer();
    } else if (next === 'background' || next === 'inactive') {
      // keep timer; cheap. Could clear to save battery:
      // clearSyncTimer();
    }
  };
  appStateSub = AppState.addEventListener('change', onAppState);

  // Immediate if already logged in
  if (getCurrentUser()) {
    runAutoBootstrap('start').catch(() => {});
    startSyncTimer();
  }

  return () => {
    started = false;
    authUnsub?.();
    authUnsub = null;
    appStateSub?.remove();
    appStateSub = null;
    clearSyncTimer();
  };
}

// Re-export helper used above without circular import issues
export { isSupabaseConfigured };
