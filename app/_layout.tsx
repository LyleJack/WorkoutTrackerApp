import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { initDB } from '@/src/db';

export default function RootLayout() {
  useEffect(() => { initDB(); }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: '#888',
        tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a4a' },
        headerStyle: { backgroundColor: '#1a1a2e' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Tabs.Screen name="index" options={{
        title: 'Workouts',
        tabBarIcon: ({ color, size }) => <Ionicons name="barbell-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="history" options={{
        title: 'History',
        tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="stats" options={{
        title: 'Stats',
        tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="progress" options={{
        title: 'Progress',
        tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" size={size} color={color} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: 'Settings',
        tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
      }} />
      {/* Hide nested routes */}
      <Tabs.Screen name="workout/[id]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="workout/log/[sessionId]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="workout/cardio/[sessionId]" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
