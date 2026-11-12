import React from 'react';
import { Tabs, router } from 'expo-router';
import { FloatingPillNav } from '../../components/FloatingPillNav';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={({ state }: any) => {
        const currentRoute = state.routes[state.index]?.name || 'index';
        return (
          <FloatingPillNav
            activeRoute={currentRoute}
            onNavigate={(route) => {
              if (route === 'index') {
                router.navigate('/(tabs)/');
              } else {
                router.navigate(`/(tabs)/${route}` as any);
              }
            }}
          />
        );
      }}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="bill" options={{ title: 'Bill' }} />
      <Tabs.Screen name="tanong" options={{ title: 'Tanong' }} />
      <Tabs.Screen name="plugs" options={{ title: 'Smart Plugs' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', href: null }} />
    </Tabs>
  );
}
