import { NativeModules, Platform, DeviceEventEmitter } from 'react-native';

const { FloatingTimer: Native } = NativeModules as {
  FloatingTimer?: {
    hasPermission:     () => Promise<boolean>;
    requestPermission: () => void;
    show:   (seconds: number, isDark: boolean) => void;
    update: (seconds: number) => void;
    hide:   () => void;
    ping:   () => void;
  };
};

const isAvailable = Platform.OS === 'android' && !!Native;

export const FloatingTimer = {
  isAvailable,

  hasPermission: async (): Promise<boolean> => {
    if (!isAvailable) return false;
    return Native!.hasPermission();
  },

  requestPermission: () => {
    if (!isAvailable) return;
    Native!.requestPermission();
  },

  show: (seconds: number, isDark: boolean) => {
    if (!isAvailable) return;
    Native!.show(seconds, isDark);
  },

  update: (seconds: number) => {
    if (!isAvailable) return;
    Native!.update(seconds);
  },

  hide: () => {
    if (!isAvailable) return;
    Native!.hide();
  },

  /**
   * Ask the native service if it's currently running and get remaining seconds.
   * Result comes back via the 'FloatingTimerPong' DeviceEventEmitter event.
   */
  ping: () => {
    if (!isAvailable) return;
    Native!.ping();
  },
};
