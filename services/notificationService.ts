// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Set notification handler only once
let handlerSet = false;
export function initializeNotificationHandler() {
  if (!handlerSet && typeof Notifications !== 'undefined') {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      handlerSet = true;
    } catch (error) {
      console.error('Error setting notification handler:', error);
    }
  }
}

interface ScheduledNotification {
  taskId: string;
  notificationId: string;
}

const NOTIFICATIONS_STORAGE_KEY = 'scheduled_notifications';

export const notificationService = {
  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      if (typeof Notifications === 'undefined' || Platform.OS === 'web') {
        return false;
      }
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  },

  // Schedule a task reminder
  async scheduleTaskReminder(
    taskId: string,
    taskTitle: string,
    reminderTime: Date
  ): Promise<string> {
    try {
      if (typeof Notifications === 'undefined' || Platform.OS === 'web') {
        console.warn('Notifications not supported on web');
        return '';
      }
      initializeNotificationHandler();

      // ── FIX 1: Always verify we have permission before scheduling ──
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('[Notification] Permission not granted — skipping schedule');
        return '';
      }

      // Ensure the time is in the future; if not, add a day
      let triggerDate = new Date(reminderTime);
      const now = new Date();
      if (triggerDate <= now) {
        triggerDate.setDate(triggerDate.getDate() + 1);
        console.log('[Notification] Time was in the past. Rescheduled for tomorrow:', triggerDate.toString());
      }

      // NOTE: Expo SDK 52's DATE trigger type has a known bug where the
      // notification fires immediately instead of at the given date
      // (https://github.com/expo/expo/issues/33141). TIME_INTERVAL (a
      // relative "fire in N seconds" delay) does not have this bug, so we
      // compute the delta ourselves and use that instead.
      const secondsUntilTrigger = Math.max(
        1,
        Math.round((triggerDate.getTime() - Date.now()) / 1000)
      );

      // Schedule notification using a relative delay, tagged to the
      // HIGH-importance channel created in NotificationManager.tsx so it
      // actually rings/vibrates instead of silently landing in a default
      // low-priority channel.
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Task Reminder',
          body: `Time to work on: ${taskTitle}`,
          sound: 'default', // Use system default notification sound
          badge: 1,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: secondsUntilTrigger,
          repeats: false,
          channelId: 'task-reminders',
        },
      });

      // ── FIX 2: Remove any existing entry for this taskId BEFORE adding ──
      // the new one, so the stored list never has stale duplicates that
      // prevent future cancel calls from finding the live notification.
      const notifications: ScheduledNotification[] = await this.getStoredNotifications();
      const cleaned = notifications.filter((n) => n.taskId !== taskId);
      cleaned.push({ taskId, notificationId });
      await AsyncStorage.setItem(
        NOTIFICATIONS_STORAGE_KEY,
        JSON.stringify(cleaned)
      );

      console.log(`[Notification] Scheduled for ${triggerDate.toString()} (in ${secondsUntilTrigger}s) with ID ${notificationId}`);
      return notificationId;
    } catch (error) {
      console.error('Error scheduling task reminder:', error);
      throw error;
    }
  },

  // Cancel reminder
  async cancelReminder(taskId: string): Promise<void> {
    try {
      if (typeof Notifications === 'undefined' || Platform.OS === 'web') return;

      const notifications: ScheduledNotification[] = await this.getStoredNotifications();
      // ── FIX 2b: Cancel ALL entries for this taskId, not just the first ──
      const toCancel = notifications.filter((n) => n.taskId === taskId);
      const remaining = notifications.filter((n) => n.taskId !== taskId);

      for (const entry of toCancel) {
        try {
          await Notifications.cancelScheduledNotificationAsync(entry.notificationId);
        } catch {
          // Notification may have already fired or been cleared — that's fine
        }
      }

      if (toCancel.length > 0) {
        await AsyncStorage.setItem(
          NOTIFICATIONS_STORAGE_KEY,
          JSON.stringify(remaining)
        );
        console.log(`[Notification] Cancelled ${toCancel.length} notification(s) for task ${taskId}`);
      }
    } catch (error) {
      console.error('Error canceling reminder:', error);
    }
  },

  // Get all stored notifications
  async getStoredNotifications(): Promise<ScheduledNotification[]> {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting stored notifications:', error);
      return [];
    }
  },

  // Cancel all reminders
  async cancelAllReminders(): Promise<void> {
    try {
      if (typeof Notifications === 'undefined' || Platform.OS === 'web') return;

      const notifications: ScheduledNotification[] = await this.getStoredNotifications();
      for (const notification of notifications) {
        try {
          await Notifications.cancelScheduledNotificationAsync(notification.notificationId);
        } catch {
          // Already fired or cleared
        }
      }
      await AsyncStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
      console.log('[Notification] All reminders cancelled');
    } catch (error) {
      console.error('Error canceling all reminders:', error);
    }
  },

  // Send immediate notification (for testing)
  async sendImmediateNotification(title: string, body: string): Promise<void> {
    try {
      if (typeof Notifications === 'undefined' || Platform.OS === 'web') return;
      initializeNotificationHandler();

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
        },
        trigger: null, // null means "immediately"
      });
      console.log(`[Notification] Immediate notification sent: ${title}`);
    } catch (error) {
      console.error('Error sending immediate notification:', error);
    }
  },
};