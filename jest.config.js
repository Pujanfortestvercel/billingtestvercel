module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jestSetup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(postprocessing|@react-native|react-native|@react-navigation|react-native-url-polyfill|@react-native-async-storage|react-native-config|react-native-print|react-native-share|react-native-image-picker)/)',
  ],
};
