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
        tabBarInactiveTintColor: '#333',
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#111',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerShown: false,
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
      <Tabs.Screen name="workout/[id]"            options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="workout/log/[sessionId]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="workout/cardio/[sessionId]" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
