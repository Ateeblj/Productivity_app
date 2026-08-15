module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // No reanimated plugin — app uses RN Animated API only on mobile
    plugins: [],
  };
};
