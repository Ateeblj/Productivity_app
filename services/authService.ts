// services/authService.ts
//
// Real accounts via Supabase Auth. Same account works from any device.
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  initSupabaseFromStorage,
  getSupabaseConfigSnapshot,
} from './supabaseClient';
import { setActiveUserId, loadActiveUserId } from './identity';

export interface User {
  uid: string;
  email: string;
  displayName: string | null;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  error?: string;
  needsEmailConfirmation?: boolean;
}

let currentUser: User | null = null;
let hydrated = false;

function toUser(supabaseUser: SupabaseUser | null | undefined): User | null {
  if (!supabaseUser) return null;
  return {
    uid: supabaseUser.id,
    email: supabaseUser.email ?? '',
    displayName: (supabaseUser.user_metadata?.display_name as string | undefined) ?? null,
  };
}

type AuthListener = (user: User | null, hydrated: boolean) => void;
const listeners = new Set<AuthListener>();

function notifyListeners(user: User | null) {
  listeners.forEach((listener) => {
    try {
      listener(user, hydrated);
    } catch (err) {
      console.error('Error in auth listener:', err);
    }
  });
}

/**
 * Mark boot complete so UI is never stuck on the loading spinner.
 * Safe to call multiple times.
 */
function markHydrated(user: User | null = currentUser) {
  currentUser = user;
  if (!hydrated) {
    hydrated = true;
    notifyListeners(currentUser);
  } else {
    notifyListeners(currentUser);
  }
}

export function subscribeToAuthChanges(listener: AuthListener): () => void {
  listeners.add(listener);
  // Always fire once immediately so UI can react
  listener(currentUser, hydrated);
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentUser(): User | null {
  return currentUser;
}

// Hard timeout: never leave the app on "Loading…" forever.
// getSession() can hang on bad network / placeholder Supabase URL.
const BOOT_TIMEOUT_MS = 800;

let authListenerAttached = false;
let bootTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
  if (!hydrated) {
    console.warn(
      '[authService] Session restore timed out after',
      BOOT_TIMEOUT_MS,
      'ms — showing auth screen.',
    );
    markHydrated(null);
  }
}, BOOT_TIMEOUT_MS);

function attachAuthListener() {
  if (authListenerAttached) return;
  authListenerAttached = true;
  supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
    // Ignore noisy INITIAL_SESSION if we already hydrated from getSession
    if (event === 'INITIAL_SESSION') return;
    markHydrated(toUser(session?.user ?? null));
  });
}

/**
 * Call AFTER initSupabaseFromStorage(). Restores session only when the user
 * has completed database setup (saved keys). Prevents auto-login from .env.
 */
export async function restoreAuthSession(): Promise<void> {
  if (bootTimer) {
    clearTimeout(bootTimer);
    bootTimer = null;
  }
  if (!isSupabaseConfigured) {
    markHydrated(null);
    return;
  }
  attachAuthListener();
  try {
    const { data } = await supabase.auth.getSession();
    markHydrated(toUser(data.session?.user ?? null));
  } catch (err) {
    console.warn('[authService] Could not restore session:', err);
    markHydrated(null);
  }
}

// Safe default until App.tsx finishes DB init
markHydrated(null);

function friendlyError(message: string | undefined): string {
  if (!message) return 'Something went wrong.';
  const msg = message.toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    const snap = getSupabaseConfigSnapshot();
    const host = snap.url ? snap.url.replace(/^https?:\/\//, '').split('/')[0] : 'this project';
    return (
      'Email or password not accepted by ' +
      host +
      '. Use the account that was created on THIS Project URL. If you switched projects, connect the old project URL + anon key, then log in again.'
    );
  }
  if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
    return 'This email is already registered on this database. Use Log in instead of Create account.';
  }
  if (msg.includes('password') && msg.includes('6')) return 'Password must be at least 6 characters.';
  if (msg.includes('email not confirmed')) return 'Email not confirmed yet. Open the new link from Resend, or turn OFF Confirm email in Supabase Authentication settings, then log in.';
  if (msg.includes('network')) return 'Network error — check your internet connection.';
  if (msg.includes('fetch') || msg.includes('failed to fetch')) {
    return 'Cannot reach Supabase. Check internet and Project URL.';
  }
  return message;
}

export async function signUp(email: string, password: string, name: string): Promise<AuthResult> {
  try {
    await initSupabaseFromStorage();
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Connect your database first (one-time setup).',
      };
    }
    const formattedEmail = email.toLowerCase().trim();
    if (password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters.' };
    }
    const { data, error } = await supabase.auth.signUp({
      email: formattedEmail,
      password,
      options: {
        data: { display_name: name.trim() || null },
      },
    });
    if (error) return { success: false, error: friendlyError(error.message) };
    if (data.user && !data.session) {
      try {
        const { bindLocalDataToUser } = await import('./syncedStorage');
        await bindLocalDataToUser(data.user.id, { isNewAccount: true });
      } catch {
        /* ignore */
      }
      return {
        success: true,
        needsEmailConfirmation: true,
        user: toUser(data.user) ?? undefined,
      };
    }
    const user = toUser(data.user);
    if (user) {
      const { bindLocalDataToUser } = await import('./syncedStorage');
      await bindLocalDataToUser(user.uid, { isNewAccount: true });
      markHydrated(user);
    }
    return { success: true, user: user ?? undefined };
  } catch (e: any) {
    return { success: false, error: friendlyError(e?.message) };
  }
}


export async function resendConfirmationEmail(email: string): Promise<AuthResult> {
  try {
    await initSupabaseFromStorage();
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Database not connected on this device.' };
    }
    const formattedEmail = email.toLowerCase().trim();
    if (!formattedEmail) return { success: false, error: 'Enter your email first.' };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: formattedEmail,
    });
    if (error) return { success: false, error: friendlyError(error.message) };
    return { success: true };
  } catch (e: any) {
    return { success: false, error: friendlyError(e?.message) };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    // Always reload keys from storage so login uses the project you last saved
    await initSupabaseFromStorage();
    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'No database saved on this device yet. Complete database setup once, then log in.',
      };
    }
    const formattedEmail = email.toLowerCase().trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formattedEmail,
      password,
    });
    if (error) return { success: false, error: friendlyError(error.message) };
    const user = toUser(data.user);
    if (user) {
      const { bindLocalDataToUser } = await import('./syncedStorage');
      // Switch local data to this user (wipe only if different account than last)
      await bindLocalDataToUser(user.uid, { isNewAccount: false });
      markHydrated(user);
    }
    return { success: true, user: user ?? undefined };
  } catch (e: any) {
    return { success: false, error: friendlyError(e?.message) };
  }
}

export async function signOut(): Promise<void> {
  // LOGOUT TRANSACTION: stop identity first, then session, then clear active user
  try {
    // Sync is session-gated; clearing identity stops meaningful cloud writes
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  } catch (e) {
    console.warn('[authService] signOut error', e);
  } finally {
    try {
      const { unbindLocalDataUser } = await import('./syncedStorage');
      await unbindLocalDataUser();
    } catch {
      /* ignore */
    }
    await setActiveUserId(null);
    markHydrated(null);
  }
}
