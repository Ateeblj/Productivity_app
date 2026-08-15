/**
 * Identity boundary: user_id is the only key for user data.
 * Project config (URL/anon) is device-level and separate from identity.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACTIVE_USER_ID_KEY = 'identity_active_user_id';
export const GUEST_USER_ID = 'guest';

let memoryActiveUserId: string | null = null;

export function getActiveUserId(): string | null {
  return memoryActiveUserId;
}

export async function loadActiveUserId(): Promise<string | null> {
  try {
    const id = await AsyncStorage.getItem(ACTIVE_USER_ID_KEY);
    memoryActiveUserId = id;
    return id;
  } catch {
    memoryActiveUserId = null;
    return null;
  }
}

export async function setActiveUserId(userId: string | null): Promise<void> {
  memoryActiveUserId = userId;
  try {
    if (userId) await AsyncStorage.setItem(ACTIVE_USER_ID_KEY, userId);
    else await AsyncStorage.removeItem(ACTIVE_USER_ID_KEY);
  } catch (e) {
    console.warn('[identity] setActiveUserId', e);
  }
}

/** Local key namespace: u:{userId}:{logicalKey} */
export function namespacedKey(userId: string, logicalKey: string): string {
  return `u:${userId}:${logicalKey}`;
}
