import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar, useColorScheme } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDB, getPref, setPref } from '@/src/db';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  ThemeContext, ThemeUpdateContext, ThemeMode,
  darkPalette, lightPalette, ThemePalette, useTheme, FONT,
} from '@/src/theme';

// ─── Shared header ────────────────────────────────────────────────────────────
export function AppHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  const statusH = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
  return (
    <View style={[
      hStyles.header,
      { paddingTop: statusH + 10, backgroundColor: t.bg, borderBottomColor: t.border },
    ]}>
      <Text style={[hStyles.title, { color: t.textPrimary }]}>{title}</Text>
      {right != null && <View style={hStyles.right}>{right}</View>}
    </View>
  );
}

const hStyles = StyleSheet.create({
  header: {
    paddingBottom: 14, paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  title: { fontSize: FONT['4xl'], fontWeight: '800', letterSpacing: -0.5 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 2 },
});

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  const deviceScheme                    = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeMode]       = useState<ThemeMode>('dark');
  const [palette,   setPalette]         = useState<ThemePalette>(darkPalette);
  const [fontsLoaded, setFontsLoaded]   = useState(false);

  // Resolve palette from mode + device scheme
  function resolvePalette(mode: ThemeMode, scheme: typeof deviceScheme): ThemePalette {
    if (mode === 'device') return scheme === 'light' ? lightPalette : darkPalette;
    return mode === 'light' ? lightPalette : darkPalette;
  }

  function updateTheme(mode: ThemeMode) {
    setThemeMode(mode);
    setPalette(resolvePalette(mode, deviceScheme));
    setPref('theme_mode', mode);
  }

  // Re-resolve when device scheme changes (only matters if mode === 'device')
  useEffect(() => {
    if (themeMode === 'device') {
      setPalette(resolvePalette('device', deviceScheme));
    }
  }, [deviceScheme, themeMode]);

  useEffect(() => {
    // DB init is synchronous and cheap — run immediately
    try {
      initDB();
      const saved = (getPref('theme_mode') ?? 'dark') as ThemeMode;
      setThemeMode(saved);
      setPalette(resolvePalette(saved, deviceScheme));
    } catch (e) {
      console.error('[DB] init failed:', e);
    }

    // Fonts load in background — UI renders without waiting
    Font.loadAsync({ ...Ionicons.font })
      .then(() => setFontsLoaded(true))
      .catch(() => setFontsLoaded(true));
  }, []);

  const t = palette;

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={palette}>
        <ThemeUpdateContext.Provider value={updateTheme}>
          <ErrorBoundary fallbackLabel="A critical error occurred. Please restart the app.">
            <StatusBar
              barStyle={t.isDark ? 'light-content' : 'dark-content'}
              backgroundColor={t.bg}
            />
            <Tabs
              screenOptions={{
                tabBarActiveTintColor:   t.tabActive,
                tabBarInactiveTintColor: t.tabInactive,
                tabBarStyle: {
                  backgroundColor: t.tabBg,
                  borderTopColor:  t.tabBorder,
                  borderTopWidth:  1,
                  height:          60,
                  paddingBottom:   8,
                },
                tabBarLabelStyle: { fontSize: FONT.sm, fontWeight: '600' },
                headerShown: false,
              }}
            >
              <Tabs.Screen name="index"    options={{ title: 'Workouts', tabBarIcon: ({ color, size }) => fontsLoaded ? <Ionicons name="barbell-outline"     size={size} color={color} /> : <View style={{ width: size, height: size }} /> }} />
              <Tabs.Screen name="history"  options={{ title: 'History',  tabBarIcon: ({ color, size }) => fontsLoaded ? <Ionicons name="time-outline"        size={size} color={color} /> : <View style={{ width: size, height: size }} /> }} />
              <Tabs.Screen name="routine"  options={{ title: 'Routine',  tabBarIcon: ({ color, size }) => fontsLoaded ? <Ionicons name="calendar-outline"    size={size} color={color} /> : <View style={{ width: size, height: size }} /> }} />
              <Tabs.Screen name="stats"    options={{ title: 'Stats',    tabBarIcon: ({ color, size }) => fontsLoaded ? <Ionicons name="stats-chart-outline" size={size} color={color} /> : <View style={{ width: size, height: size }} /> }} />
              <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color, size }) => fontsLoaded ? <Ionicons name="trending-up-outline" size={size} color={color} /> : <View style={{ width: size, height: size }} /> }} />
              <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => fontsLoaded ? <Ionicons name="settings-outline"    size={size} color={color} /> : <View style={{ width: size, height: size }} /> }} />
              <Tabs.Screen name="workout/[id]"                options={{ href: null, headerShown: false }} />
              <Tabs.Screen name="workout/log/[sessionId]"     options={{ href: null, headerShown: false }} />
              <Tabs.Screen name="workout/cardio/[sessionId]"  options={{ href: null, headerShown: false }} />
              <Tabs.Screen name="workout/summary/[sessionId]" options={{ href: null, headerShown: false }} />
            </Tabs>
          </ErrorBoundary>
        </ThemeUpdateContext.Provider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
