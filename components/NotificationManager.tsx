import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { initializeNotificationHandler } from '../services/notificationService';

// Use the same handler config as notificationService.ts so badge behavior
// (and every other setting) is consistent everywhere, instead of two
// competing setNotificationHandler() calls fighting over shouldSetBadge.
initializeNotificationHandler();

export default function NotificationManager() {
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    // Notifications aren't supported on web; requesting permission here
    // pops a real browser prompt for a feature the rest of the app
    // deliberately disables on web (see notificationService.ts).
    if (Platform.OS === 'web') {
      return;
    }
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('task-reminders', {
            name: 'Task Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2563EB', // Updated to match Tailwind blue-600
          });
        }
        console.log('✅ Notifications enabled');
      }
    } catch (e) {
      console.error('Notification setup error:', e);
    }
  };

  return null;
}