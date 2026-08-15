import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppIcon from '../AppIcon';
import { CommonActions, NavigationProp, ParamListBase } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import colors from '../../utils/colors';
import FloatingTabBar, { TAB_ROOT_SCREENS } from './FloatingTabBar';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

type Action = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Tab route name inside MobileTabNavigator */
  tab: string;
  /** Optional nested stack screen inside that tab */
  screen?: string;
};

const ACTIONS: Action[] = [
  { label: 'Search', icon: 'search-outline', tab: 'Overview', screen: 'Search' },
  { label: 'Year review', icon: 'stats-chart-outline', tab: 'Overview', screen: 'Yearly' },
  { label: 'Month calendar', icon: 'calendar-number-outline', tab: 'Calendar' },
  { label: 'Roadmaps', icon: 'map-outline', tab: 'Overview', screen: 'Roadmaps' },
  { label: 'Generate roadmap', icon: 'sparkles-outline', tab: 'Overview', screen: 'RoadmapAI' },
  { label: 'Settings / Account', icon: 'settings-outline', tab: 'Overview', screen: 'Settings' },
];

function getDeepestRouteName(state: any): string | undefined {
  if (!state?.routes?.length) return undefined;
  let route = state.routes[state.index ?? 0];
  while (route?.state?.routes?.length) {
    route = route.state.routes[route.state.index ?? 0];
  }
  return route?.name;
}

type Props = BottomTabBarProps;

/**
 * Combined floating tab bar + center quick-action FAB.
 * Center button is integrated into the pill (elevated circle), matching the reference design.
 * Entire chrome is hidden on nested screens (Settings, Roadmaps, etc.).
 */
export default function MobileTabChrome(props: Props) {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const { state, navigation } = props;

  const deepName = getDeepestRouteName(state);
  const hideChrome = !!(deepName && !TAB_ROOT_SCREENS.has(deepName));

  const run = (a: Action) => {
    setOpen(false);
    setTimeout(() => {
      try {
        if (a.screen) {
          navigation.navigate(a.tab as never, { screen: a.screen } as never);
        } else {
          navigation.navigate(a.tab as never);
        }
      } catch {
        navigation.dispatch(
          CommonActions.navigate({
            name: a.tab,
            params: a.screen ? { screen: a.screen } : undefined,
          }),
        );
      }
    }, 50);
  };

  if (hideChrome) {
    return null;
  }

  return (
    <>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menuWrap} pointerEvents="box-none">
            <ScrollView
              style={styles.menuScroll}
              contentContainerStyle={styles.menu}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {ACTIONS.map((a) => (
                <Pressable
                  key={a.label}
                  onPress={() => run(a)}
                  style={[
                    styles.menuItem,
                    {
                      backgroundColor: isDark ? 'rgba(20,20,36,0.98)' : '#fff',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                >
                  <AppIcon name={a.icon} size={18} color={palette.primary} />
                  <Text style={[styles.menuLabel, { color: isDark ? '#F0EFFF' : '#1A1A1A' }]}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <FloatingTabBar
        {...props}
        centerOpen={open}
        onCenterPress={() => setOpen((v) => !v)}
      />
    </>
  );
}

/** @deprecated use MobileTabChrome — kept for any external imports */
export function MobileFAB({
  navigation,
}: {
  bottomInset?: number;
  navigation: NavigationProp<ParamListBase>;
}) {
  return null;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 110,
  },
  menuWrap: {
    maxHeight: '70%',
    width: '100%',
    alignItems: 'center',
  },
  menuScroll: {
    maxHeight: 420,
    width: '100%',
  },
  menu: {
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 100,
    minWidth: 200,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  menuLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
