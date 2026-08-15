// services/syncedStorage.ts
//
// Drop-in replacement for AsyncStorage.setItem/removeItem on the specific
// keys we want backed up to the cloud. Reads are untouched (plain
// AsyncStorage.getItem) — local storage is always the source of truth for
// day-to-day reads; the cloud is only consulted on login and on manual sync.
//
// IMPORTANT: media (recorded audio/video, and web's base64 media blobs)
// is intentionally NEVER synced here — see mediaService.ts / notesService.ts.
// Only small text/JSON data goes to the cloud, so this stays free forever
// on Supabase's free tier.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import {
  getActiveUserId,
  setActiveUserId,
  namespacedKey,
  GUEST_USER_ID,
  loadActiveUserId,
} from './identity';
import { getCurrentUser } from './authService';

export const SYNCED_KEYS = [
  'myNotes', // note text/titles/colors + local media URIs (not the media itself)
  'myFolders',
  'dailyTasks',
  // weeklyRoutineTasks removed — Weekly board is derived from app_actions
  'weeklyHistory',
  'monthlyEvents',
  'yearlyGoals',
  'roadmap_state',
  'learning_units', // Goals: Learning Units + mastery state
  // 'curriculum_goal' removed — legacy single goal; migration in goalsService cleans local only
  'curriculum_goals',
  'active_goal_id',
  'habit_definitions', // Actions: habit definitions (support units)
  'app_actions', // Actions: executable tasks / habits / revision
  'app_theme',
] as const;

export type SyncedKey = (typeof SYNCED_KEYS)[number];

/** Tracks which account the on-device data currently belongs to. */
/** @deprecated use identity ACTIVE_USER_ID_KEY — kept for migration */
export const ACTIVE_DATA_USER_KEY = 'active_data_user_id';

/** Extra local keys that are not cloud-synced but still user-specific. */
const LOCAL_ONLY_USER_KEYS = [
  'curriculum_goal',
  'weeklyRoutineTasks',
  'habit_completions',
  'notes_search_recent',
] as const;


function allLogicalKeys(): string[] {
  const keys: string[] = [...SYNCED_KEYS, ...LOCAL_ONLY_USER_KEYS];
  for (const key of SYNCED_KEYS) {
    keys.push('__sync_meta_updated_at__:' + key);
  }
  keys.push('__sync_last_success_at__', '__sync_last_failed_keys__');
  return keys;
}

/** Wipe ONLY the active user's namespaced (+ legacy flat) productivity keys. */
export async function clearLocalSyncedData(): Promise<void> {
  const uid = getActiveUserId();
  const logical = allLogicalKeys();
  const keys: string[] = [...logical];
  if (uid) {
    for (const k of logical) keys.push(namespacedKey(uid, k));
  }
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (e) {
    console.warn('[syncedStorage] clearLocalSyncedData', e);
  }
}

/**
 * Establish identity context for local + sync.
 * Does NOT wipe another user's namespaced data — only switches activeUserId.
 * New account: clear THIS user's namespace (empty start).
 * Different user: just switch; their namespace loads independently.
 */
export async function bindLocalDataToUser(
  uid: string,
  options: { isNewAccount?: boolean } = {},
): Promise<void> {
  await setActiveUserId(uid);
  // Migrate legacy flat keys into this user's namespace once
  await migrateLegacyFlatKeysToUser(uid);
  if (options.isNewAccount) {
    // Empty slate for brand-new signup under this uid only
    const logical = allLogicalKeys();
    await AsyncStorage.multiRemove(logical.map((k) => namespacedKey(uid, k)));
    await AsyncStorage.multiRemove(logical);
  }
  // Keep legacy marker for older code paths
  await AsyncStorage.setItem(ACTIVE_DATA_USER_KEY, uid);
}

/** Logout transaction: drop active identity; do not delete other users' namespaces. */
export async function unbindLocalDataUser(): Promise<void> {
  const uid = getActiveUserId();
  // Clear legacy flat keys so guest cannot see last user
  await AsyncStorage.multiRemove(allLogicalKeys());
  if (uid && uid !== GUEST_USER_ID) {
    // Keep namespaced cloud cache for faster re-login; only clear active pointer
  }
  await setActiveUserId(null);
  await AsyncStorage.removeItem(ACTIVE_DATA_USER_KEY);
}

async function migrateLegacyFlatKeysToUser(uid: string): Promise<void> {
  for (const k of allLogicalKeys()) {
    const ns = namespacedKey(uid, k);
    try {
      const existing = await AsyncStorage.getItem(ns);
      if (existing != null) continue;
      const flat = await AsyncStorage.getItem(k);
      if (flat != null) {
        await AsyncStorage.setItem(ns, flat);
      }
    } catch {
      /* ignore */
    }
  }
}

function resolveKey(logicalKey: string): string {
  const uid = getActiveUserId();
  if (!uid) return logicalKey; // no identity → flat (guest/offline until bound)
  return namespacedKey(uid, logicalKey);
}


function isSyncedKey(key: string): key is SyncedKey {
  return (SYNCED_KEYS as readonly string[]).includes(key);
}

const META_PREFIX = '__sync_meta_updated_at__:';
const LAST_SYNC_AT_KEY = '__sync_last_success_at__';
const LAST_SYNC_FAILED_KEY = '__sync_last_failed_keys__';

async function getLocalUpdatedAt(key: string): Promise<string | null> {
  return AsyncStorage.getItem(resolveKey(META_PREFIX + key));
}

async function setLocalUpdatedAt(key: string, iso: string): Promise<void> {
  await AsyncStorage.setItem(resolveKey(META_PREFIX + key), iso);
}

/** ISO timestamp of last fully successful pullAndMerge, or null. */
export async function getLastSyncAt(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_AT_KEY);
  } catch {
    return null;
  }
}

/** Keys that failed during the most recent sync attempt (push or merge). */
export async function getLastSyncFailedKeys(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SYNC_FAILED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function recordSyncOutcome(successAt: string | null, failedKeys: string[]): Promise<void> {
  try {
    if (successAt) {
      await AsyncStorage.setItem(LAST_SYNC_AT_KEY, successAt);
    }
    await AsyncStorage.setItem(LAST_SYNC_FAILED_KEY, JSON.stringify(failedKeys));
  } catch {
    /* ignore meta write failures */
  }
}

// Chain cloud pushes so rapid-fire writes to the same key can't race each
// other and land out of order.
let pushChain: Promise<void> = Promise.resolve();

/** Scalar keys stored as plain strings in AsyncStorage (not JSON-encoded). */
const SCALAR_STRING_KEYS = new Set<string>(['active_goal_id', 'app_theme']);

/**
 * Local AsyncStorage may hold either JSON (arrays/objects) or plain strings
 * (active_goal_id, app_theme). Never throw on parse — cloud push must not spam.
 */
function parseLocalValue(rawValue: string): unknown {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed === 'null' ||
    /^-?\d+(\.\d+)?$/.test(trimmed)
  ) {
    try {
      return JSON.parse(rawValue);
    } catch {
      return rawValue;
    }
  }
  // Plain string ids / theme labels (e.g. goal_abc, dark)
  return rawValue;
}

function serializeLocalValue(key: string, value: unknown): string {
  if (SCALAR_STRING_KEYS.has(key) && typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

async function pushToCloud(key: SyncedKey, rawValue: string | null): Promise<void> {
  const user = getCurrentUser();
  if (!user) return; // not logged in — stays local-only, nothing to push

  const nowIso = new Date().toISOString();
  try {
    if (rawValue === null) {
      const { error } = await supabase
        .from('user_data')
        .delete()
        .eq('user_id', user.uid)
        .eq('key', key);
      if (error) throw error;
    } else {
      const value = parseLocalValue(rawValue);
      const { error } = await supabase.from('user_data').upsert(
        {
          user_id: user.uid,
          key,
          value,
          updated_at: nowIso,
        },
        { onConflict: 'user_id,key' }
      );
      if (error) throw error;
    }
    await setLocalUpdatedAt(key, nowIso);
  } catch (err) {
    // Offline, RLS not set up yet, etc. The local write already succeeded,
    // so the user's data is safe — this key just won't be caught up in the
    // cloud until the next successful push or manual "Sync now".
    console.warn(`[syncedStorage] Cloud push failed for "${key}":`, err);
  }
}

/** Use in place of AsyncStorage.setItem for any of the SYNCED_KEYS. */
export async function setItem(key: string, value: string): Promise<void> {
  await AsyncStorage.setItem(resolveKey(key), value);
  // also write flat while active for older readers during transition
  if (getActiveUserId()) {
    try { await AsyncStorage.setItem(key, value); } catch { /* ignore */ }
  }
  if (isSyncedKey(key)) {
    pushChain = pushChain.then(() => pushToCloud(key, value));
  }
}

/** Use in place of AsyncStorage.removeItem for any of the SYNCED_KEYS. */
export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(resolveKey(key));
  try { await AsyncStorage.removeItem(key); } catch { /* ignore */ }
  if (isSyncedKey(key)) {
    pushChain = pushChain.then(() => pushToCloud(key, null));
  }
}

// Plain passthrough — reads never need special handling.
export async function getItem(key: string): Promise<string | null> {
  const uid = getActiveUserId();
  if (uid) {
    const ns = await AsyncStorage.getItem(namespacedKey(uid, key));
    if (ns != null) return ns;
  }
  return AsyncStorage.getItem(key);
}

// ── Merge helpers ─────────────────────────────────────────────────
//
// Instead of replacing the whole blob with whichever side is "newer"
// (which silently drops items unique to the other side), we now merge
// at the item level: union by `id`, with per-item `updatedAt` as the
// tiebreaker for items that exist on both sides.

/** Keys whose value is an array of `{ id, ... }` objects. */
const ARRAY_KEYS: ReadonlySet<string> = new Set([
  'myNotes',
  'myFolders',
  'dailyTasks',
  'monthlyEvents',
  'yearlyGoals',
  'learning_units',
  'habit_definitions',
  'app_actions',
]);

/** Keys whose value is a dict of Task arrays, e.g. { Monday: Task[] }. */
const DICT_OF_ARRAYS_KEYS: ReadonlySet<string> = new Set([
  // weeklyRoutineTasks retired — no longer synced
]);

/** Keys whose value is a dict of plain objects (shallow merge). */
const DICT_SHALLOW_KEYS: ReadonlySet<string> = new Set([
  'weeklyHistory',
]);

interface IdItem {
  id: string;
  updatedAt?: number;
  [key: string]: any;
}

function isPlainObj(v: any): v is Record<string, any> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Merge two arrays of `{ id, ... }` objects by taking the union of IDs.
 * - Items unique to one side → always kept (this is the core fix).
 * - Items on both sides → the one with the higher `updatedAt` wins;
 *   if timestamps are missing or equal, `preferCloud` breaks the tie.
 */
function mergeArrayByIds(
  localArr: IdItem[],
  cloudArr: IdItem[],
  preferCloud: boolean,
): IdItem[] {
  const localMap = new Map<string, IdItem>();
  for (const item of localArr) {
    if (item.id != null) localMap.set(String(item.id), item);
  }

  const merged = new Map<string, IdItem>();

  for (const cloudItem of cloudArr) {
    if (cloudItem.id == null) continue;
    const cid = String(cloudItem.id);
    const localItem = localMap.get(cid);

    if (!localItem) {
      // Only in cloud → keep it
      merged.set(cid, cloudItem);
    } else {
      // On both sides → compare per-item timestamps
      const ct = cloudItem.updatedAt ?? 0;
      const lt = localItem.updatedAt ?? 0;
      if (ct > lt) {
        merged.set(cid, cloudItem);
      } else if (lt > ct) {
        merged.set(cid, localItem);
      } else {
        // Timestamps equal or both missing → key-level tiebreaker
        merged.set(cid, preferCloud ? cloudItem : localItem);
      }
      localMap.delete(cid);
    }
  }

  // Items only in local → keep them
  for (const [id, item] of localMap) {
    merged.set(id, item);
  }

  return Array.from(merged.values());
}

/**
 * Merge two dicts where each value is an array of `{ id, ... }` objects.
 * Formerly used for weeklyRoutineTasks (removed). Kept for any future dict-of-arrays keys.
 */
function mergeDictOfArrays(
  localDict: Record<string, IdItem[]>,
  cloudDict: Record<string, IdItem[]>,
  preferCloud: boolean,
): Record<string, IdItem[]> {
  const allKeys = new Set([...Object.keys(localDict), ...Object.keys(cloudDict)]);
  const merged: Record<string, IdItem[]> = {};

  for (const key of allKeys) {
    const localArr = Array.isArray(localDict[key]) ? localDict[key] : [];
    const cloudArr = Array.isArray(cloudDict[key]) ? cloudDict[key] : [];

    if (localArr.length === 0 && cloudArr.length > 0) {
      merged[key] = cloudArr;
    } else if (cloudArr.length === 0 && localArr.length > 0) {
      merged[key] = localArr;
    } else {
      merged[key] = mergeArrayByIds(localArr, cloudArr, preferCloud);
    }
  }

  return merged;
}

/**
 * Shallow-merge two dicts of plain objects.
 * Used for `weeklyHistory` = { "2026-07-07": { Monday: 80, … } }.
 * For overlapping week keys, `preferCloud` decides which wins.
 */
function mergeDictShallow(
  localDict: Record<string, any>,
  cloudDict: Record<string, any>,
  preferCloud: boolean,
): Record<string, any> {
  const merged = { ...localDict };

  for (const [key, value] of Object.entries(cloudDict)) {
    if (!(key in merged)) {
      // Only in cloud → keep it
      merged[key] = value;
    } else if (preferCloud) {
      merged[key] = value;
    }
    // else keep local version
  }

  return merged;
}

/**
 * Pick the right merge strategy for a given key, then merge local + cloud
 * values and return the result. For keys that don't fit any structured
 * pattern (e.g. `app_theme`), fall back to last-write-wins.
 */
function mergeByKey(
  key: string,
  localValue: any,
  cloudValue: any,
  preferCloud: boolean,
): any {
  if (ARRAY_KEYS.has(key)) {
    const localArr = Array.isArray(localValue) ? localValue : [];
    const cloudArr = Array.isArray(cloudValue) ? cloudValue : [];
    return mergeArrayByIds(localArr, cloudArr, preferCloud);
  }

  if (DICT_OF_ARRAYS_KEYS.has(key)) {
    const localDict = isPlainObj(localValue) ? localValue : {};
    const cloudDict = isPlainObj(cloudValue) ? cloudValue : {};
    return mergeDictOfArrays(localDict, cloudDict, preferCloud);
  }

  if (DICT_SHALLOW_KEYS.has(key)) {
    const localDict = isPlainObj(localValue) ? localValue : {};
    const cloudDict = isPlainObj(cloudValue) ? cloudValue : {};
    return mergeDictShallow(localDict, cloudDict, preferCloud);
  }

  // Plain value (e.g. app_theme) → simple last-write-wins
  return preferCloud ? cloudValue : localValue;
}

// ── Sync ──────────────────────────────────────────────────────────

export interface SyncResult {
  pulled: string[];
  pushed: string[];
  failed: string[];
  lastSyncAt: string | null;
}

/**
 * Pull every synced key down from Supabase and merge it into local storage
 * at the ITEM level (union by `id`), then push up any synced keys the cloud
 * doesn't have yet (first sync from a fresh device/account).
 *
 * This replaces the old "last-write-wins per whole key" logic that would
 * silently drop items unique to the losing side (the reported data-loss bug).
 *
 * Call this after login and whenever the user taps "Sync now".
 */
export async function pullAndMerge(): Promise<SyncResult> {
  const user = getCurrentUser();
  if (!user) return { pulled: [], pushed: [], failed: [], lastSyncAt: await getLastSyncAt() };

  const { data, error } = await supabase
    .from('user_data')
    .select('key, value, updated_at')
    .eq('user_id', user.uid);

  if (error) throw error;

  const pulled: string[] = [];
  const pushed: string[] = [];
  const failed: string[] = [];
  const cloudKeys = new Set<string>();

  for (const row of data ?? []) {
    cloudKeys.add(row.key);

    const localRaw = await getItem(row.key);
    const localUpdatedAt = await getLocalUpdatedAt(row.key);
    const cloudIsNewer =
      !localUpdatedAt ||
      new Date(row.updated_at).getTime() > new Date(localUpdatedAt).getTime();

    // ── Nothing local → take cloud wholesale ──
    if (!localRaw) {
      await setItem(row.key, serializeLocalValue(row.key, row.value));
      await setLocalUpdatedAt(row.key, row.updated_at);
      pulled.push(row.key);
      continue;
    }

    // ── Both sides have data → merge ──
    const localValue: any = parseLocalValue(localRaw);

    const mergedValue = mergeByKey(row.key, localValue, row.value, cloudIsNewer);

    const mergedStr = serializeLocalValue(row.key, mergedValue);
    const localStr = serializeLocalValue(row.key, localValue);
    const cloudStr = serializeLocalValue(row.key, row.value);

    const localChanged = mergedStr !== localStr;
    const cloudChanged = mergedStr !== cloudStr;

    if (localChanged || cloudChanged) {
      const nowIso = new Date().toISOString();

      if (localChanged) {
        await setItem(row.key, mergedStr);
        pulled.push(row.key);
      }

      // Push the merged result back to cloud so the other device gets
      // the full union on its next sync too.
      if (cloudChanged) {
        try {
          const { error: pushErr } = await supabase.from('user_data').upsert(
            {
              user_id: user.uid,
              key: row.key,
              value: mergedValue,
              updated_at: nowIso,
            },
            { onConflict: 'user_id,key' },
          );
          if (pushErr) throw pushErr;
          pushed.push(row.key);
        } catch (pushErr) {
          console.warn(
            `[syncedStorage] Failed to push merged "${row.key}" back to cloud:`,
            pushErr,
          );
          failed.push(row.key);
        }
      }

      await setLocalUpdatedAt(row.key, localChanged || cloudChanged
        ? new Date().toISOString()
        : row.updated_at);
    } else {
      // Identical content on both sides — just sync the timestamp marker
      if (cloudIsNewer) {
        await setLocalUpdatedAt(row.key, row.updated_at);
      }
    }
  }

  // Push keys that exist locally but not in the cloud at all
  // (first sync from this device, or a key the cloud has never seen).
  for (const key of SYNCED_KEYS) {
    if (cloudKeys.has(key)) continue;
    const localValue = await getItem(key);
    if (localValue !== null) {
      try {
        await pushToCloud(key, localValue);
        pushed.push(key);
      } catch (e) {
        console.warn(`[syncedStorage] first-push failed for "${key}"`, e);
        failed.push(key);
      }
    }
  }

  const lastSyncAt = failed.length === 0 ? new Date().toISOString() : await getLastSyncAt();
  if (failed.length === 0) {
    await recordSyncOutcome(lastSyncAt, []);
  } else {
    await recordSyncOutcome(null, failed);
  }

  return { pulled, pushed, failed, lastSyncAt };
}
