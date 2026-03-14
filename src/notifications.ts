import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Expo Go (SDK 53+) removed push notification support.
// We must avoid importing expo-notifications entirely in Expo Go,
// because it auto-registers for push tokens at module load time and throws.
// appOwnership === 'expo' means running inside Expo Go.
const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

const NOTIF_ID_KEY   = 'daily_notif_id';
const NOTIF_TIME_KEY = 'daily_notif_time';

// Lazily import expo-notifications only when not in Expo Go
async function getNotifications() {
  if (IS_EXPO_GO) return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

export async function setupNotificationHandler() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async (notification: any) => {
      const checkToday = notification.request.content.data?.checkWorkoutToday;
      if (checkToday) {
        try {
          const { hasWorkoutToday } = await import('@/src/db');
          if (hasWorkoutToday()) {
            return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false };
          }
        } catch {}
      }
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyNotification(hour: number, minute: number) {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const existing = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (existing) await Notifications.cancelScheduledNotificationAsync(existing).catch(() => {});

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💪 Workout time!',
      body:  "Don't forget to log today's workout.",
      sound: true,
      data:  { checkWorkoutToday: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(NOTIF_ID_KEY, id);
  await AsyncStorage.setItem(NOTIF_TIME_KEY, `${hour}:${minute}`);
  return id;
}

export async function cancelDailyNotification() {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  const existing = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing);
    await AsyncStorage.removeItem(NOTIF_ID_KEY);
  }
}

export async function getSavedNotificationTime(): Promise<{ hour: number; minute: number } | null> {
  const saved = await AsyncStorage.getItem(NOTIF_TIME_KEY);
  if (!saved) return null;
  const [h, m] = saved.split(':').map(Number);
  return { hour: h, minute: m };
}

export function isNotificationsSupported(): boolean {
  return !IS_EXPO_GO;
}
