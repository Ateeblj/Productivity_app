import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveToStorage = async (key: string, value: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Error saving to storage:', e);
  }
};

export const loadFromStorage = async <T,>(key: string): Promise<T | null> => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error loading from storage:', e);
    return null;
  }
};

export const removeFromStorage = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error('Error removing from storage:', e);
  }
};

export const STORAGE_KEYS = {
  THEME: 'app_theme',
  USER_PREFS: 'user_preferences',
  DRAFT_NOTE: 'draft_note',
  DRAFT_TASK: 'draft_task',
  ONBOARDED: 'has_onboarded',
};