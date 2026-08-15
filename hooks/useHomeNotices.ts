// hooks/useHomeNotices.ts
// Boy Scout extract: first-launch + auto-pack notice (items 10–11).
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { consumeAutoPackOptInNotice } from '../services/autoBootstrapService';
import { FIRST_LAUNCH_DONE_KEY } from '../components/FirstLaunchFlow';

export function useHomeNotices() {
  const [autoPackNotice, setAutoPackNotice] = useState<string | null>(null);
  const [showFirstLaunch, setShowFirstLaunch] = useState(false);

  const loadNotices = useCallback(async () => {
    try {
      const notice = await consumeAutoPackOptInNotice();
      if (notice) setAutoPackNotice(notice);
    } catch { /* ignore */ }
    try {
      const done = await AsyncStorage.getItem(FIRST_LAUNCH_DONE_KEY);
      if (done !== '1') setShowFirstLaunch(true);
    } catch { /* ignore */ }
  }, []);

  return {
    autoPackNotice,
    setAutoPackNotice,
    showFirstLaunch,
    setShowFirstLaunch,
    loadNotices,
  };
}
