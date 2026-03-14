const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Redirect expo-keep-awake to our silent mock in Expo Go
config.resolver.extraNodeModules = {
  'expo-keep-awake': path.resolve(__dirname, 'mocks/expo-keep-awake.js'),
};

module.exports = config;
