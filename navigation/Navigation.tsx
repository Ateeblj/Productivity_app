// navigation/Navigation.tsx
// Mobile uses tab shell ONLY — never imports drawer/reanimated (Expo Go safe).
// Desktop/web lazy-loads AppDrawer.
import React, { useContext, useMemo } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  Platform,
} from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import colors from "../utils/colors";
import AuthScreen from "../screens/AuthScreen";
import MobileTabNavigator, { shouldUseMobileShell } from "./MobileTabNavigator";

const RootStack = createNativeStackNavigator();

function DesktopApp() {
  // Lazy require so Metro does not load drawer/reanimated on native bundles
  // when this component is never mounted.
  const AppDrawer = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./AppDrawer").default as React.ComponentType;
  }, []);
  return <AppDrawer />;
}

export default function RootNavigator() {
  const { loading, canUseApp } = useContext(AuthContext);
  const { isDark } = useTheme();
  const palette = isDark ? colors.dark : colors.light;
  const mobile = shouldUseMobileShell();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: palette.background,
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={{ marginTop: 16, color: palette.textMuted, fontSize: 14, textAlign: "center" }}>
          Starting app…
        </Text>
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!canUseApp ? (
        <RootStack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <RootStack.Screen
          name="App"
          component={mobile ? MobileTabNavigator : DesktopApp}
        />
      )}
    </RootStack.Navigator>
  );
}
