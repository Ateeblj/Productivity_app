// navigation/AppDrawer.tsx
// Web/desktop drawer — visual GUI matches the reference app (MAIN/TOOLS) exactly.
import React, { useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  Platform,
  useWindowDimensions,
  Pressable,
} from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerActions,
} from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AppIcon from "../components/AppIcon";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import colors from "../utils/colors";
import AnimatedPressable from "../components/AnimatedPressable";

import HomeScreen from "../screens/HomeScreen";
import NotesScreen from "../screens/NotesScreen";
import DailyTaskScreen from "../screens/DailyTaskScreen";
import WeeklyPlannerScreen from "../screens/WeeklyPlannerScreen";
import MonthlyPlannerScreen from "../screens/MonthlyPlannerScreen";
import YearlyPlannerScreen from "../screens/YearlyPlannerScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SearchScreen from "../screens/SearchScreen";
import RoadmapScreen from "../screens/RoadmapScreen";
import RoadmapsScreen from "../screens/RoadmapsScreen";

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator();
const SIDEBAR_WIDTH = 280;
const SIDEBAR_COLLAPSED = 72;

type NavItem = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
  section: "main" | "tools";
};

const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", label: "Home", icon: "home", iconOutline: "home-outline", section: "main" },
  { name: "Notes", label: "Notes", icon: "document-text", iconOutline: "document-text-outline", section: "main" },
  { name: "Daily", label: "Today", icon: "checkbox", iconOutline: "checkbox-outline", section: "main" },
  { name: "Weekly", label: "This week", icon: "grid", iconOutline: "grid-outline", section: "main" },
  { name: "Roadmaps", label: "Roadmaps", icon: "map", iconOutline: "map-outline", section: "main" },
  { name: "Monthly", label: "Life calendar", icon: "calendar", iconOutline: "calendar-outline", section: "main" },
  { name: "Yearly", label: "Year review", icon: "stats-chart", iconOutline: "stats-chart-outline", section: "main" },
  { name: "RoadmapAI", label: "Generate roadmap", icon: "sparkles", iconOutline: "sparkles-outline", section: "tools" },
  { name: "Search", label: "Search", icon: "search", iconOutline: "search-outline", section: "tools" },
  { name: "Settings", label: "Settings", icon: "settings", iconOutline: "settings-outline", section: "tools" },
];

function SidebarItem({ item, active, onPress, palette, collapsed }: any) {
  return (
    <AnimatedPressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        paddingVertical: 11,
        paddingHorizontal: collapsed ? 0 : 12,
        borderRadius: 8,
        marginHorizontal: 8,
        marginBottom: 2,
        backgroundColor: active ? (palette.sidebarHover || palette.primarySurface) : "transparent",
      }}
    >
      <AppIcon
        name={active ? item.icon : item.iconOutline}
        size={18}
        color={active ? palette.text : palette.textMuted}
        style={collapsed ? undefined : { marginRight: 10, width: 22 }}
      />
      {!collapsed && (
        <Text
          style={{
            fontSize: 14,
            fontWeight: active ? "600" : "500",
            color: active ? palette.text : palette.textSecondary,
          }}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      )}
    </AnimatedPressable>
  );
}

function CustomDrawerContent(props: any) {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const { user } = useContext(AuthContext);
  const current = props.state.routes[props.state.index]?.name;
  const main = NAV_ITEMS.filter((i) => i.section === "main");
  const tools = NAV_ITEMS.filter((i) => i.section === "tools");
  const collapsed = !!props.collapsed;
  const canCollapse = !!props.canCollapse;
  const onToggleCollapse = props.onToggleCollapse as (() => void) | undefined;

  const go = (name: string) => {
    props.navigation.navigate(name);
    if (!canCollapse) {
      requestAnimationFrame(() => {
        try {
          props.navigation.closeDrawer();
        } catch {
          props.navigation.dispatch(DrawerActions.closeDrawer());
        }
      });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.sidebar || palette.surface }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{ paddingTop: Platform.OS === "web" ? 16 : 8, paddingBottom: 24 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: collapsed ? 12 : 16,
            paddingVertical: 12,
            marginBottom: 8,
            justifyContent: collapsed ? "center" : "flex-start",
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: palette.primary,
              alignItems: "center",
              justifyContent: "center",
              marginRight: collapsed ? 0 : 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
              {(user?.displayName || user?.email || "P").charAt(0).toUpperCase()}
            </Text>
          </View>
          {!collapsed && (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: palette.text }} numberOfLines={1}>
                {user?.displayName || "Workspace"}
              </Text>
              <Text style={{ fontSize: 11, color: palette.textMuted }} numberOfLines={1}>
                {user?.email || "Personal"}
              </Text>
            </View>
          )}
          {!collapsed && (
            <AnimatedPressable
              onPress={() => {
                if (canCollapse && onToggleCollapse) {
                  onToggleCollapse();
                  return;
                }
                try {
                  props.navigation.closeDrawer();
                } catch {
                  props.navigation.dispatch(DrawerActions.closeDrawer());
                }
              }}
              hitSlop={12}
              style={{ padding: 8 }}
            >
              <AppIcon name={canCollapse ? "chevron-back" : "close"} size={22} color={palette.textMuted} />
            </AnimatedPressable>
          )}
        </View>

        {collapsed && canCollapse && onToggleCollapse ? (
          <Pressable
            onPress={onToggleCollapse}
            style={{
              alignSelf: "center",
              marginBottom: 12,
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
            }}
          >
            <AppIcon name="chevron-forward" size={18} color={palette.textMuted} />
          </Pressable>
        ) : null}

        {!collapsed ? (
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: palette.textMuted,
              paddingHorizontal: 20,
              marginTop: 8,
              marginBottom: 4,
              letterSpacing: 0.5,
            }}
          >
            MAIN
          </Text>
        ) : null}
        {main.map((item) => (
          <SidebarItem
            key={item.name}
            item={item}
            active={current === item.name}
            onPress={() => go(item.name)}
            palette={palette}
            collapsed={collapsed}
          />
        ))}

        {collapsed ? (
          <View style={{ height: 1, marginHorizontal: 16, marginVertical: 10, backgroundColor: palette.border }} />
        ) : (
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: palette.textMuted,
              paddingHorizontal: 20,
              marginTop: 16,
              marginBottom: 4,
              letterSpacing: 0.5,
            }}
          >
            TOOLS
          </Text>
        )}
        {tools.map((item) => (
          <SidebarItem
            key={item.name}
            item={item}
            active={current === item.name}
            onPress={() => go(item.name)}
            palette={palette}
            collapsed={collapsed}
          />
        ))}
      </DrawerContentScrollView>
    </View>
  );
}

function HeaderMenuButton({
  wide,
  onToggleCollapse,
}: {
  wide: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const navigation = useNavigation<any>();

  const openMenu = () => {
    if (wide) {
      onToggleCollapse();
      return;
    }
    let nav: any = navigation;
    for (let i = 0; i < 5 && nav; i++) {
      if (typeof nav.toggleDrawer === "function") {
        nav.toggleDrawer();
        return;
      }
      if (typeof nav.openDrawer === "function") {
        nav.openDrawer();
        return;
      }
      nav = nav.getParent?.();
    }
    try {
      navigation.dispatch(DrawerActions.toggleDrawer());
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatedPressable
      onPress={openMenu}
      hitSlop={16}
      style={{
        marginLeft: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minWidth: 44,
        minHeight: 44,
        justifyContent: "center",
        alignItems: "center",
      }}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <AppIcon name="menu" size={26} color={palette.text} />
    </AnimatedPressable>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

export default function AppDrawer() {
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= 900;
  const [collapsed, setCollapsed] = useState(false);
  const canCollapse = wide;
  const drawerWidth = wide
    ? collapsed
      ? SIDEBAR_COLLAPSED
      : SIDEBAR_WIDTH
    : Math.min(SIDEBAR_WIDTH, Math.max(260, width * 0.78));

  const toggleCollapse = useCallback(() => setCollapsed((v) => !v), []);

  return (
    <Drawer.Navigator
      id="MainDrawer"
      drawerContent={(props) => (
        <CustomDrawerContent
          {...props}
          collapsed={collapsed && canCollapse}
          canCollapse={canCollapse}
          onToggleCollapse={toggleCollapse}
        />
      )}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: palette.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: palette.border,
        } as any,
        headerTintColor: palette.text,
        headerTitleStyle: { fontWeight: "600", fontSize: 16 },
        headerShadowVisible: false,
        drawerType: wide ? "permanent" : "front",
        swipeEnabled: !wide && Platform.OS !== "web",
        drawerPosition: "left",
        drawerStyle: {
          width: drawerWidth,
          backgroundColor: palette.sidebar || palette.surface,
          borderRightWidth: 1,
          borderRightColor: palette.border,
        },
        overlayColor: "rgba(0,0,0,0.5)",
        sceneContainerStyle: { backgroundColor: palette.background },
        headerLeft: () => (
          <HeaderMenuButton wide={wide} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        ),
        headerLeftContainerStyle: { paddingLeft: 0 },
      }}
    >
      <Drawer.Screen name="Dashboard" component={HomeScreen} options={{ title: "Home" }} />
      <Drawer.Screen name="Notes" component={NotesScreen} options={{ title: "Notes" }} />
      <Drawer.Screen name="Daily" component={DailyTaskScreen} options={{ title: "Today" }} />
      <Drawer.Screen name="Weekly" component={WeeklyPlannerScreen} options={{ title: "This week" }} />
      <Drawer.Screen name="Roadmaps" component={RoadmapsScreen} options={{ title: "Roadmaps" }} />
      <Drawer.Screen name="Monthly" component={MonthlyPlannerScreen} options={{ title: "Life calendar" }} />
      <Drawer.Screen name="Yearly" component={YearlyPlannerScreen} options={{ title: "Year review" }} />
      <Drawer.Screen name="RoadmapAI" component={RoadmapScreen} options={{ title: "Generate roadmap" }} />
      <Drawer.Screen name="Search" component={SearchScreen} options={{ title: "Search" }} />
      <Drawer.Screen name="Settings" component={SettingsStack} options={{ title: "Settings" }} />
    </Drawer.Navigator>
  );
}
