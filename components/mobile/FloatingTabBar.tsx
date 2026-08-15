import React from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppIcon from '../AppIcon';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import colors from '../../utils/colors';

const LEFT_TABS: {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'Overview', label: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'Notes', label: 'Notes', icon: 'document-text', iconOutline: 'document-text-outline' },
];

const RIGHT_TABS: {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'Today', label: 'Today', icon: 'checkbox', iconOutline: 'checkbox-outline' },
  { name: 'Week', label: 'Week', icon: 'calendar', iconOutline: 'calendar-outline' },
];

/** Nested stack roots — tab bar visible only on these */
export const TAB_ROOT_SCREENS = new Set([
  'OverviewHome',
  'NotesHome',
  'DailyHome',
  'WeeklyHome',
  'CalendarHome',
  'Overview',
  'Notes',
  'Today',
  'Week',
  'Calendar',
]);

function getDeepestRouteName(state: any): string | undefined {
  if (!state?.routes?.length) return undefined;
  let route = state.routes[state.index ?? 0];
  while (route?.state?.routes?.length) {
    route = route.state.routes[route.state.index ?? 0];
  }
  return route?.name;
}

type Props = BottomTabBarProps & {
  onCenterPress?: () => void;
  centerOpen?: boolean;
};

export default function FloatingTabBar({ state, navigation, onCenterPress, centerOpen }: Props) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const routeName = state.routes[state.index]?.name;
  const deepName = getDeepestRouteName(state);

  // Hide entire bar when user is on nested screens (Settings, Roadmaps, Search, etc.)
  if (deepName && !TAB_ROOT_SCREENS.has(deepName)) {
    return null;
  }

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) {
      navigation.navigate(name as never);
      return;
    }
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(name as never);
    }
  };

  const renderTab = (tab: (typeof LEFT_TABS)[0]) => {
    const active = routeName === tab.name;
    return (
      <Pressable
        key={tab.name}
        onPress={() => go(tab.name)}
        style={styles.tab}
        accessibilityRole="button"
        accessibilityLabel={tab.label}
      >
        <AppIcon
          name={active ? tab.icon : tab.iconOutline}
          size={20}
          color={active ? palette.primary : isDark ? '#6b6b8a' : '#8a8aa0'}
        />
        <Text
          style={[
            styles.label,
            { color: active ? palette.primary : isDark ? '#6b6b8a' : '#8a8aa0' },
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 6) + 4 }]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? 'rgba(14,14,20,0.96)' : 'rgba(255,255,255,0.97)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        {LEFT_TABS.map(renderTab)}

        {/* Center elevated action button — matches reference design */}
        <View style={styles.centerSlot}>
          <Pressable
            onPress={onCenterPress}
            style={[
              styles.centerBtn,
              {
                backgroundColor: palette.primary,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.35)',
              },
            ]}
            accessibilityLabel="Quick actions"
          >
            <AppIcon name={centerOpen ? 'close' : 'add'} size={28} color="#fff" />
          </Pressable>
        </View>

        {RIGHT_TABS.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
  },
  pill: {
    height: 62,
    borderRadius: 32,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 18,
      },
      android: { elevation: 16 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  centerSlot: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    borderWidth: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#7c3aed',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.55,
        shadowRadius: 14,
      },
      android: { elevation: 14 },
    }),
  },
});
