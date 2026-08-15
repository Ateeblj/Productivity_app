// Mobile shell — real app screens (Daily / Weekly / Notes / Calendar), not stubs
import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import colors from '../utils/colors';
import MobileTabChrome from '../components/mobile/MobileFAB';

import HomeScreen from '../screens/HomeScreen';
import NotesScreen from '../screens/NotesScreen';
import DailyTaskScreen from '../screens/DailyTaskScreen';
import WeeklyPlannerScreen from '../screens/WeeklyPlannerScreen';
import MonthlyPlannerScreen from '../screens/MonthlyPlannerScreen';
import YearlyPlannerScreen from '../screens/YearlyPlannerScreen';
import RoadmapsScreen from '../screens/RoadmapsScreen';
import RoadmapScreen from '../screens/RoadmapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SearchScreen from '../screens/SearchScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function stackScreenOptions(palette: typeof colors.dark) {
  return {
    headerShown: true as const,
    headerStyle: { backgroundColor: palette.background },
    headerTintColor: palette.text,
    headerTitleStyle: { fontWeight: '700' as const, fontSize: 17 },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: palette.background },
  };
}

function HomeStack() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(palette)}>
      <Stack.Screen name="OverviewHome" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Roadmaps" component={RoadmapsScreen} options={{ title: 'Roadmaps' }} />
      <Stack.Screen name="RoadmapAI" component={RoadmapScreen} options={{ title: 'Generate roadmap' }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      <Stack.Screen name="Settings" component={ProfileScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Yearly" component={YearlyPlannerScreen} options={{ title: 'Year review' }} />
      <Stack.Screen name="Daily" component={DailyTaskScreen} options={{ title: 'Today' }} />
      <Stack.Screen name="Weekly" component={WeeklyPlannerScreen} options={{ title: 'This week' }} />
      <Stack.Screen name="Notes" component={NotesScreen} options={{ title: 'Notes' }} />
    </Stack.Navigator>
  );
}

function NotesStack() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(palette)}>
      <Stack.Screen name="NotesHome" component={NotesScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function TodayStack() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(palette)}>
      <Stack.Screen name="DailyHome" component={DailyTaskScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function WeekStack() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(palette)}>
      <Stack.Screen name="WeeklyHome" component={WeeklyPlannerScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function CalendarStack() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(palette)}>
      <Stack.Screen name="CalendarHome" component={MonthlyPlannerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Yearly" component={YearlyPlannerScreen} options={{ title: 'Year review' }} />
    </Stack.Navigator>
  );
}

export default function MobileTabNavigator() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  // Extra bottom padding so content clears the floating pill + elevated center FAB
  const bottomPad = Math.max(insets.bottom, 8) + 78;

  return (
    <View style={[styles.root, { backgroundColor: palette.background, paddingTop: insets.top }]}>
      <Tab.Navigator
        tabBar={(props) => <MobileTabChrome {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: {
            backgroundColor: palette.background,
            paddingBottom: bottomPad,
          },
        }}
      >
        <Tab.Screen name="Overview" component={HomeStack} options={{ title: 'Home' }} />
        <Tab.Screen name="Notes" component={NotesStack} options={{ title: 'Notes' }} />
        <Tab.Screen name="Today" component={TodayStack} options={{ title: 'Today' }} />
        <Tab.Screen name="Week" component={WeekStack} options={{ title: 'Week' }} />
        {/* Calendar kept as 5th route for FAB navigation but not shown as a 5th tab slot;
            users reach it via center menu or Home shortcuts. */}
        <Tab.Screen
          name="Calendar"
          component={CalendarStack}
          options={{ title: 'Calendar', tabBarButton: () => null }}
        />
      </Tab.Navigator>
    </View>
  );
}

export function shouldUseMobileShell(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
