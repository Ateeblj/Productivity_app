/**
 * Metro stub for react-native-reanimated when native module is not linked.
 * Provides enough API so @react-navigation/drawer and similar do not crash.
 * Uses RN's built-in Animated where useful; createAnimatedComponent is identity.
 */
const React = require('react');
const RN = require('react-native');

function createAnimatedComponent(Component) {
  if (Component == null) return Component;
  // Identity — no native reanimated worklets
  return Component;
}

function makeValue(init) {
  const v = typeof init === 'object' && init && 'value' in init ? init.value : init;
  return {
    value: v,
    set value(n) {
      this._v = n;
    },
    get value() {
      return this._v !== undefined ? this._v : v;
    },
    _v: v,
    addListener() {},
    removeListener() {},
    removeAllListeners() {},
    interpolate() {
      return makeValue(0);
    },
  };
}

const AnimatedAPI = {
  createAnimatedComponent,
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  FlatList: RN.FlatList,
  call() {},
  createAnimatedPropAdapter() {
    return {};
  },
  addWhitelistedNativeProps() {},
  addWhitelistedUIProps() {},
};

// Common named exports used by drawer / gesture libs
function useSharedValue(init) {
  const ref = React.useRef(makeValue(init));
  return ref.current;
}

function useAnimatedStyle(fn) {
  try {
    return typeof fn === 'function' ? fn() || {} : {};
  } catch {
    return {};
  }
}

function useDerivedValue(fn) {
  try {
    return makeValue(typeof fn === 'function' ? fn() : fn);
  } catch {
    return makeValue(0);
  }
}

function useAnimatedRef() {
  return React.useRef(null);
}

function withTiming(to) {
  return to;
}
function withSpring(to) {
  return to;
}
function withDelay(_d, v) {
  return v;
}
function withSequence(...vals) {
  return vals[vals.length - 1];
}
function withRepeat(v) {
  return v;
}
function runOnJS(fn) {
  return fn;
}
function runOnUI(fn) {
  return fn;
}
function interpolate(value) {
  return value;
}
function Extrapolation() {
  return { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };
}
Extrapolation.CLAMP = 'clamp';
Extrapolation.EXTEND = 'extend';
Extrapolation.IDENTITY = 'identity';

function EasingObj() {}
EasingObj.linear = (t) => t;
EasingObj.ease = (t) => t;
EasingObj.quad = (t) => t;
EasingObj.cubic = (t) => t;
EasingObj.poly = () => (t) => t;
EasingObj.sin = (t) => t;
EasingObj.circle = (t) => t;
EasingObj.exp = (t) => t;
EasingObj.elastic = () => (t) => t;
EasingObj.back = () => (t) => t;
EasingObj.bounce = (t) => t;
EasingObj.bezier = () => (t) => t;
EasingObj.in = (e) => e;
EasingObj.out = (e) => e;
EasingObj.inOut = (e) => e;

const api = {
  ...AnimatedAPI,
  default: AnimatedAPI,
  createAnimatedComponent,
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useAnimatedRef,
  useAnimatedScrollHandler: () => ({}),
  useAnimatedGestureHandler: () => ({}),
  useAnimatedProps: (fn) => {
    try {
      return typeof fn === 'function' ? fn() || {} : {};
    } catch {
      return {};
    }
  },
  useAnimatedReaction: () => {},
  useFrameCallback: () => ({ setActive: () => {} }),
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
  runOnUI,
  interpolate,
  Extrapolation,
  Easing: EasingObj,
  FadeIn: {},
  FadeOut: {},
  Layout: {},
  SlideInRight: {},
  SlideOutLeft: {},
  ZoomIn: {},
  ZoomOut: {},
  // Shared value constructor style
  makeMutable: makeValue,
  cancelAnimation: () => {},
  measure: () => null,
  scrollTo: () => {},
};

module.exports = api;
