// services/supabaseClient.ts
//
// Shared Supabase client. Credentials can come from:
// 1) User-pasted URL + anon key (AsyncStorage) — preferred for standalone BYO DB
// 2) EXPO_PUBLIC_SUPABASE_* env (build-time fallback)
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_CONFIG_URL_KEY = 'user_supabase_url';
export const SUPABASE_CONFIG_KEY_KEY = 'user_supabase_anon_key';
/** One database (project URL) ↔ one app account on this device */
export const BOUND_ACCOUNT_EMAIL_KEY = 'bound_account_email';
export const BOUND_ACCOUNT_UID_KEY = 'bound_account_uid';

const AUTH_OPTS = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
} as const;

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

// Never treat .env alone as "user finished database setup" — that caused auto-login
// and skipped onboarding. Only AsyncStorage keys the user saved count.
let currentUrl = PLACEHOLDER_URL;
let currentKey = PLACEHOLDER_KEY;
let configured = false;

let inner: SupabaseClient = createClient(currentUrl, currentKey, AUTH_OPTS);

/** Live client — always points at the active credentials. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const value = Reflect.get(inner, prop, receiver);
    return typeof value === 'function' ? value.bind(inner) : value;
  },
}) as SupabaseClient;

/** Synchronous flag used by auth / sync services. Updated after init / save. */
export let isSupabaseConfigured = configured;

export function getSupabaseConfigSnapshot(): { url: string; configured: boolean } {
  return {
    url: configured ? currentUrl : '',
    configured,
  };
}

function cleanCredential(raw: string): string {
  return raw
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '')
    .trim();
}

/** Decode JWT payload (middle segment). Returns null if not a JWT. */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    // atob is available in RN / web
    const json =
      typeof atob === 'function'
        ? atob(b64)
        : Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function projectRefFromUrl(url: string): string | null {
  try {
    const host = url.replace(/^https?:\/\//, '').split('/')[0];
    // xxx.supabase.co
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function assertAnonKeyUsable(url: string, key: string): void {
  if (key.startsWith('sb_secret') || key.startsWith('sb_service')) {
    throw new Error('That is a secret key. Use the key labeled anon / public only.');
  }
  // New publishable keys are fine
  if (key.startsWith('sb_publishable_')) return;

  const payload = decodeJwtPayload(key);
  if (payload) {
    const role = String(payload.role || '');
    if (role === 'service_role') {
      throw new Error('That is the service_role secret key. Use the anon public key (role: anon).');
    }
    // JWT ref must match Project URL host
    const urlRef = projectRefFromUrl(url);
    const keyRef = payload.ref ? String(payload.ref).toLowerCase() : null;
    if (urlRef && keyRef && urlRef !== keyRef) {
      throw new Error(
        'Project URL and key are from different projects. URL ref is "' +
          urlRef +
          '" but key is for "' +
          keyRef +
          '". Copy both from the same project API page.',
      );
    }
  }
}

function applyCredentials(url: string, anonKey: string) {
  let cleanUrl = url.trim().replace(/\/$/, '').replace(/^["']|["']$/g, '');
  const cleanKey = cleanCredential(anonKey);
  if (!cleanUrl || !cleanKey) {
    throw new Error('Project URL and anon public key are both required.');
  }
  if (!cleanUrl.startsWith('https://')) {
    throw new Error('Project URL must start with https:// (copy from Project Settings → API).');
  }
  if (cleanUrl.includes('supabase.com/dashboard')) {
    throw new Error('Use the Project URL from Settings → API (https://xxxx.supabase.co), not the dashboard link.');
  }
  assertAnonKeyUsable(cleanUrl, cleanKey);
  currentUrl = cleanUrl;
  currentKey = cleanKey;
  configured = true;
  isSupabaseConfigured = true;
  inner = createClient(currentUrl, currentKey, AUTH_OPTS);
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  ms = 12000,
): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => {
    try {
      ctrl?.abort();
    } catch {
      /* ignore */
    }
  }, ms);
  try {
    return await fetch(input, { ...init, signal: ctrl?.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Ping the project with the anon key so the user knows paste worked. */
export async function testSupabaseConnection(
  url?: string,
  anonKey?: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const u = (url ?? currentUrl).trim().replace(/\/$/, '').replace(/^["']|["']$/g, '');
    const k = cleanCredential(anonKey ?? currentKey);
    if (!u || !k || u.includes('placeholder')) {
      return { ok: false, message: 'Paste Project URL and anon public key first.' };
    }
    if (!u.startsWith('https://')) {
      return { ok: false, message: 'Project URL must start with https://' };
    }

    // Prefer REST with apikey — works even when /auth/v1/health is blocked
    const restUrl = u.replace(/\/$/, '') + '/rest/v1/';
    const rest = await fetchWithTimeout(restUrl, {
      method: 'GET',
      headers: {
        apikey: k,
        Authorization: 'Bearer ' + k,
        Accept: 'application/json',
      },
    });
    if (rest.status === 200 || rest.status === 404) {
      return { ok: true, message: 'OK — Project URL and anon key work. Tap Save database, then run the SQL.' };
    }
    if (rest.status === 401 || rest.status === 403) {
      // Many projects return 401 on bare /rest/v1/ even with a valid anon key.
      // If JWT decodes as anon and matches project ref, treat as success.
      try {
        assertAnonKeyUsable(u, k);
        const payload = decodeJwtPayload(k);
        if (payload && String(payload.role || '') === 'anon') {
          return {
            ok: true,
            message:
              'OK — anon key matches this project. Tap Save database, then run the SQL setup.',
          };
        }
        if (k.startsWith('sb_publishable_')) {
          return {
            ok: true,
            message: 'OK — publishable key accepted. Tap Save database, then run the SQL setup.',
          };
        }
      } catch (err: any) {
        return { ok: false, message: err?.message || 'Key rejected.' };
      }
      return {
        ok: false,
        message:
          'Key was rejected (HTTP ' +
          rest.status +
          '). Copy the FULL anon public key via the Copy button (not service_role).',
      };
    }

    const healthUrl = u.replace(/\/$/, '') + '/auth/v1/health';
    const res = await fetchWithTimeout(healthUrl, {
      method: 'GET',
      headers: { apikey: k, Authorization: 'Bearer ' + k },
    });
    if (res.ok) {
      return { ok: true, message: 'OK — connected. Tap Save database, then run the SQL.' };
    }
    return {
      ok: false,
      message:
        'Could not verify (HTTP ' +
        rest.status +
        '). Check the project is not paused and the URL is https://YOURREF.supabase.co',
    };
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    if (msg.toLowerCase().includes('abort')) {
      return { ok: false, message: 'Timed out. Check internet / that the project is not paused.' };
    }
    return {
      ok: false,
      message: msg || 'Network error. Check internet and Project URL.',
    };
  }
}

/**
 * Load credentials from AsyncStorage (user-provided) or keep env defaults.
 * Call once at app boot before relying on cloud auth/sync.
 */
export async function hasUserDatabaseSetup(): Promise<boolean> {
  try {
    const [url, key] = await Promise.all([
      AsyncStorage.getItem(SUPABASE_CONFIG_URL_KEY),
      AsyncStorage.getItem(SUPABASE_CONFIG_KEY_KEY),
    ]);
    return Boolean(url && key);
  } catch {
    return false;
  }
}

export async function initSupabaseFromStorage(): Promise<boolean> {
  try {
    const [url, key] = await Promise.all([
      AsyncStorage.getItem(SUPABASE_CONFIG_URL_KEY),
      AsyncStorage.getItem(SUPABASE_CONFIG_KEY_KEY),
    ]);
    if (url && key) {
      applyCredentials(url, key);
      return true;
    }
  } catch (e) {
    console.warn('[supabaseClient] init from storage failed', e);
  }
  // Stay on placeholder until the user completes Database setup in the app
  configured = false;
  isSupabaseConfigured = false;
  return false;
}

/** Save user credentials and switch the live client. */
export async function saveSupabaseCredentials(url: string, anonKey: string): Promise<void> {
  applyCredentials(url, anonKey);
  await AsyncStorage.setItem(SUPABASE_CONFIG_URL_KEY, currentUrl);
  await AsyncStorage.setItem(SUPABASE_CONFIG_KEY_KEY, currentKey);
  // New/relinked database → allow any account on this project (clear old lock)
  await AsyncStorage.multiRemove([BOUND_ACCOUNT_EMAIL_KEY, BOUND_ACCOUNT_UID_KEY]);
}

/** Remove user credentials (falls back to env if present). */
export async function clearSupabaseCredentials(): Promise<void> {
  await AsyncStorage.multiRemove([
    SUPABASE_CONFIG_URL_KEY,
    SUPABASE_CONFIG_KEY_KEY,
    BOUND_ACCOUNT_EMAIL_KEY,
    BOUND_ACCOUNT_UID_KEY,
  ]);
  currentUrl = PLACEHOLDER_URL;
  currentKey = PLACEHOLDER_KEY;
  configured = false;
  isSupabaseConfigured = false;
  inner = createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY, AUTH_OPTS);
}

export const SUPABASE_DASHBOARD_URL = 'https://supabase.com/dashboard';
export const SUPABASE_SIGNUP_URL = 'https://supabase.com/dashboard/sign-up';
export const SUPABASE_NEW_PROJECT_HELP = 'https://supabase.com/dashboard/projects';

/** Remember the single account allowed for the connected database on this device. */
export async function bindAccountToDatabase(email: string, uid: string): Promise<void> {
  await AsyncStorage.setItem(BOUND_ACCOUNT_EMAIL_KEY, email.toLowerCase().trim());
  await AsyncStorage.setItem(BOUND_ACCOUNT_UID_KEY, uid);
}

export async function getBoundAccount(): Promise<{ email: string | null; uid: string | null }> {
  const [email, uid] = await Promise.all([
    AsyncStorage.getItem(BOUND_ACCOUNT_EMAIL_KEY),
    AsyncStorage.getItem(BOUND_ACCOUNT_UID_KEY),
  ]);
  return { email, uid };
}

/**
 * Signup only: soft check. Sign-in is never blocked — correct password wins,
 * then we re-bind to that account (fixes stuck wrong-email lock).
 */
export async function assertAccountAllowedForDatabase(
  email: string,
  mode: 'signup' | 'signin',
): Promise<string | null> {
  if (!isSupabaseConfigured) {
    return 'Connect your database first (Project URL + anon key → Test → Save).';
  }
  if (mode === 'signin') {
    return null; // always allow login attempt
  }
  const bound = await getBoundAccount();
  const normalized = email.toLowerCase().trim();
  if (!bound.email || bound.email === normalized) return null;
  return (
    'This device was used with ' +
    bound.email +
    '. Log in with that email, or tap “Use a different account” to clear the lock and create/login with a new email.'
  );
}

/** Clear the locked email so another account can be used on this database. */
export async function clearBoundAccount(): Promise<void> {
  await AsyncStorage.multiRemove([BOUND_ACCOUNT_EMAIL_KEY, BOUND_ACCOUNT_UID_KEY]);
}
