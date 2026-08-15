const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const REANIMATED_STUB = path.resolve(__dirname, 'stubs/reanimated.js');
const EMPTY_STUB = path.resolve(__dirname, 'stubs/empty.js');

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Full API stub so drawer / navigation never crash on createAnimatedComponent
  if (
    moduleName === 'react-native-reanimated' ||
    moduleName.startsWith('react-native-reanimated/')
  ) {
    return { filePath: REANIMATED_STUB, type: 'sourceFile' };
  }
  // Worklets native module must not load
  if (
    moduleName === 'react-native-worklets' ||
    moduleName.startsWith('react-native-worklets/')
  ) {
    return { filePath: EMPTY_STUB, type: 'sourceFile' };
  }
  // Avoid optional OpenTelemetry crashes
  if (moduleName === '@opentelemetry/api' || moduleName.startsWith('@opentelemetry/api/')) {
    return { type: 'empty' };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
