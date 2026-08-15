// components/AnimatedPressable.tsx
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  Platform,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from 'react-native';

export const LIFT = {
  scaleTo: 1.05,
  liftTo: -6,
  friction: 7,
  tension: 140,
} as const;

interface Props extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  scaleTo?: number;
  liftTo?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

const OUTER_KEYS = [
  'position', 'top', 'left', 'right', 'bottom', 'zIndex',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'flex', 'alignSelf',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical',
] as const;

export default function AnimatedPressable({
  children,
  scaleTo = LIFT.scaleTo,
  liftTo = LIFT.liftTo,
  style,
  contentStyle,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  const springTo = (anim: Animated.Value, to: number) =>
    Animated.spring(anim, {
      toValue: to,
      friction: LIFT.friction,
      tension: LIFT.tension,
      useNativeDriver: true,
    });

  const activate = () => {
    if (disabled) return;
    Animated.parallel([springTo(scale, scaleTo), springTo(lift, liftTo)]).start();
  };

  const deactivate = () => {
    Animated.parallel([springTo(scale, 1), springTo(lift, 0)]).start();
  };

  let flat: any = {};
  try {
    flat = StyleSheet.flatten([style, contentStyle]) || {};
  } catch {
    flat = {};
  }

  const outer: ViewStyle = {};
  for (const k of OUTER_KEYS) {
    if (flat[k] != null) (outer as any)[k] = flat[k];
  }

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        activate();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        deactivate();
        onPressOut?.(e);
      }}
      {...(Platform.OS === 'web'
        ? ({ onHoverIn: () => activate(), onHoverOut: () => deactivate() } as any)
        : {})}
      style={outer}
    >
      <Animated.View
        style={[
          style,
          contentStyle,
          // Don't re-apply absolute on inner if outer has it — still ok
          {
            transform: [{ scale }, { translateY: lift }],
            // When outer owns size, fill it
            ...(outer.width != null || outer.height != null || outer.position === 'absolute'
              ? { width: '100%' as any, height: outer.height != null ? '100%' as any : undefined, flex: outer.flex }
              : {}),
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
