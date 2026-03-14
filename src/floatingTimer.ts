/**
 * src/floatingTimer.ts
 *
 * JS bridge to the FloatingTimerModule native module.
 *
 * In Expo Go the native module doesn't exist, so every call is a no-op —
 * the rest timer still works inside the app via the existing in-app UI.
 * In an EAS dev/preview/production build the full overlay is available.
 */
import { NativeModules, Platform } from 'react-native';

const { FloatingTimer: Native } = NativeModules as {
  FloatingTimer?: {
    hasPermission: () => Promise<boolean>;
    requestPermission: () => void;
    show:   (seconds: number) => void;
    update: (seconds: number) => void;
    hide:   () => void;
  };
};

const isAvailable = Platform.OS === 'android' && !!Native;

export const FloatingTimer = {
  /** True when running in an EAS build with the native module present */
  isAvailable,

  /** Returns true if SYSTEM_ALERT_WINDOW permission has been granted */
  hasPermission: async (): Promise<boolean> => {
    if (!isAvailable) return false;
    return Native!.hasPermission();
  },

  /**
   * Opens Android "Display over other apps" settings page if permission
   * has not yet been granted.  Safe to call unconditionally.
   */
  requestPermission: () => {
    if (!isAvailable) return;
    Native!.requestPermission();
  },

  /**
   * Show (or update) the floating bubble with a fresh countdown.
   * Requests permission automatically if not already granted.
   * @param seconds  Total seconds to count down from
   */
  show: (seconds: number) => {
    if (!isAvailable) return;
    Native!.show(seconds);
  },

  /**
   * Update the running countdown to a new value (e.g. user changed duration).
   */
  update: (seconds: number) => {
    if (!isAvailable) return;
    Native!.update(seconds);
  },

  /**
   * Dismiss the bubble and stop the background service.
   * Call this when the workout is finished or the timer is cancelled.
   */
  hide: () => {
    if (!isAvailable) return;
    Native!.hide();
  },
};
