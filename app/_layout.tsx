import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDB } from '@/src/db';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { C, FONT } from '@/src/theme';

// ─── Shared tab-screen header ─────────────────────────────────────────────────
// StatusBar.currentHeight is read inside render — it's set synchronously by the
// native bridge before the first JS frame on Android and is more reliable than
// useSafeAreaInsets() in Expo Go, which does not always forward insets to JS.
export function AppHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  const statusH = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
  return (
    <View style={[styles.header, { paddingTop: statusH + 10 }]}>
      <Text style={styles.title}>{title}</Text>
      {right != null && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: C.bg,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    color: C.white,
    fontSize: FONT['4xl'],
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 2,
  },
});

// ─── Root layout ──────────────────────────────────────────────────────────────
export default function RootLayout() {
  useEffect(() => {
    try { initDB(); } catch (e) { console.error('[DB] init failed:', e); }
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary fallbackLabel="A critical error occurred. Please restart the app.">
        <Tabs
          screenOptions={{
            tabBarActiveTintColor:   C.tabActive,
            tabBarInactiveTintColor: C.tabInactive,
            tabBarStyle: {
              backgroundColor: C.tabBg,
              borderTopColor:  C.tabBorder,
              borderTopWidth:  1,
              height:          60,
              paddingBottom:   8,
            },
            tabBarLabelStyle: { fontSize: FONT.sm, fontWeight: '600' },
            headerShown: false,
          }}
        >
          <Tabs.Screen name="index"    options={{ title: 'Workouts', tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline"     size={size} color={color} /> }} />
          <Tabs.Screen name="history"  options={{ title: 'History',  tabBarIcon: ({ color, size }) => <Ionicons name="time-outline"        size={size} color={color} /> }} />
          <Tabs.Screen name="stats"    options={{ title: 'Stats',    tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} /> }} />
          <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} /> }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline"    size={size} color={color} /> }} />
          {/* Non-tab screens — hidden from the tab bar */}
          <Tabs.Screen name="workout/[id]"               options={{ href: null, headerShown: false }} />
          <Tabs.Screen name="workout/log/[sessionId]"    options={{ href: null, headerShown: false }} />
          <Tabs.Screen name="workout/cardio/[sessionId]" options={{ href: null, headerShown: false }} />
        </Tabs>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
