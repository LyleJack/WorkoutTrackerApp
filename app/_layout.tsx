import { useEffect } from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDB } from '@/src/db';
import { ErrorBoundary } from '@/src/ErrorBoundary';

// ─── Shared tab screen header ─────────────────────────────────────────────────
// StatusBar.currentHeight is set synchronously by the native bridge before the
// first JS render on Android — the most reliable source in Expo Go where the
// safe-area context insets are not always forwarded to JS.
// Read inside the render function, never at module-load time.
export function AppHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  const sbH = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
  return (
    <View style={[hdrStyles.container, { paddingTop: sbH + 10 }]}>
      <Text style={hdrStyles.title}>{title}</Text>
      {right != null && <View style={hdrStyles.right}>{right}</View>}
    </View>
  );
}

const hdrStyles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#0f0f0f',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    color: '#fff',
    fontSize: 26,
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
    try { initDB(); } catch (e) { console.error('DB init failed', e); }
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary fallbackLabel="A critical error occurred. Try restarting the app.">
        <Tabs
          screenOptions={{
            tabBarActiveTintColor:   '#6C63FF',
            tabBarInactiveTintColor: '#333',
            tabBarStyle: {
              backgroundColor: '#000',
              borderTopColor:  '#111',
              borderTopWidth:  1,
              height:          60,
              paddingBottom:   8,
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            headerShown: false,
          }}
        >
          <Tabs.Screen name="index"    options={{ title: 'Workouts', tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline"     size={size} color={color} /> }} />
          <Tabs.Screen name="history"  options={{ title: 'History',  tabBarIcon: ({ color, size }) => <Ionicons name="time-outline"        size={size} color={color} /> }} />
          <Tabs.Screen name="stats"    options={{ title: 'Stats',    tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} /> }} />
          <Tabs.Screen name="progress" options={{ title: 'Progress', tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} /> }} />
          <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline"    size={size} color={color} /> }} />
          <Tabs.Screen name="workout/[id]"               options={{ href: null, headerShown: false }} />
          <Tabs.Screen name="workout/log/[sessionId]"    options={{ href: null, headerShown: false }} />
          <Tabs.Screen name="workout/cardio/[sessionId]" options={{ href: null, headerShown: false }} />
        </Tabs>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
