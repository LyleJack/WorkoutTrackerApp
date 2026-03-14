// Silently mock expo-keep-awake for Expo Go compatibility
module.exports = {
  activateKeepAwake: () => {},
  deactivateKeepAwake: () => {},
  activateKeepAwakeAsync: () => Promise.resolve(),
  deactivateKeepAwakeAsync: () => Promise.resolve(),
  useKeepAwake: () => {},
  ExpoKeepAwake: {},
};
