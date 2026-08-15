// Stub for packages that must not load native TurboModules in Expo Go
module.exports = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === '__esModule') return true;
      if (prop === 'default') return {};
      if (typeof prop === 'string' && prop.startsWith('use')) {
        return function stubHook() {
          return undefined;
        };
      }
      return function stubFn() {
        return undefined;
      };
    },
  }
);
