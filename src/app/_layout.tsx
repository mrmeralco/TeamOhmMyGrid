import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { EnergyProvider } from '../context/EnergyContext';
import { initNotificationHandler, registerDailyPeakAlerts } from '../lib/notificationService';

function AppNavigator() {
  const { theme, mode } = useTheme();

  useEffect(() => {
    initNotificationHandler();
    registerDailyPeakAlerts();
  }, []);

  return (
    <>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="whatif"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <EnergyProvider>
          <AppNavigator />
        </EnergyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
