import React, { createContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeToAuthChanges, User } from '../services/authService';
import { setActiveUserId, GUEST_USER_ID } from '../services/identity';

export type { User };

const GUEST_KEY = 'guest_mode';

export interface AuthContextType {
  user: User | null;
  /** Primary identity for data isolation — Supabase user.id (or guest). */
  userId: string | null;
  loading: boolean;
  error: string | null;
  guestMode: boolean;
  canUseApp: boolean;
  enterGuestMode: () => Promise<void>;
  exitGuestMode: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userId: null,
  loading: true,
  error: null,
  guestMode: false,
  canUseApp: false,
  enterGuestMode: async () => {},
  exitGuestMode: async () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestMode, setGuestMode] = useState(false);

  useEffect(() => {
    let alive = true;
    const safety = setTimeout(() => {
      if (alive) setLoading(false);
    }, 800);

    (async () => {
      try {
        const g = await AsyncStorage.getItem(GUEST_KEY);
        if (alive && g === '1') {
          setGuestMode(true);
          await setActiveUserId(GUEST_USER_ID);
        }
      } catch {
        /* ignore */
      }
    })();

    const unsubscribe = subscribeToAuthChanges((nextUser, hydrated) => {
      if (!alive) return;
      setUser(nextUser);
      if (nextUser) {
        AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
        setGuestMode(false);
        setActiveUserId(nextUser.uid).catch(() => {});
      }
      if (hydrated) {
        setLoading(false);
        clearTimeout(safety);
      }
    });

    return () => {
      alive = false;
      clearTimeout(safety);
      unsubscribe();
    };
  }, []);

  const enterGuestMode = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, '1');
    await setActiveUserId(GUEST_USER_ID);
    setGuestMode(true);
  }, []);

  const exitGuestMode = useCallback(async () => {
    await AsyncStorage.removeItem(GUEST_KEY);
    await setActiveUserId(null);
    setGuestMode(false);
  }, []);

  const userId = user?.uid ?? (guestMode ? GUEST_USER_ID : null);
  const canUseApp = !!user || guestMode;

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userId,
      loading,
      error: null,
      guestMode,
      canUseApp,
      enterGuestMode,
      exitGuestMode,
    }),
    [user, userId, loading, guestMode, canUseApp, enterGuestMode, exitGuestMode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
