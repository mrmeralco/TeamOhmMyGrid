import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { EnergyProvider } from '../context/EnergyContext';
import { initNotificationHandler, registerDailyPeakAlerts } from '../lib/notificationService';
import { StartupSplashScreen } from '../components/StartupSplashScreen';

function AppNavigator() {
  const { theme, mode } = useTheme();
  const { user, isLoading, needsBudgetSetup } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Coolvetica: require('../../assets/fonts/Coolvetica.otf'),
  });
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initNotificationHandler();
    registerDailyPeakAlerts();
  }, []);

  const currentRoute = segments[0] as string | undefined;
  const inAuthGroup = currentRoute === 'login' || currentRoute === 'register';
  const inBudgetSetup = currentRoute === 'budget-setup';

  useEffect(() => {
    if (isLoading) return;

    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && needsBudgetSetup && !inBudgetSetup) {
      router.replace('/budget-setup');
    } else if (user && !needsBudgetSetup && (inAuthGroup || inBudgetSetup)) {
      router.replace('/(tabs)');
    }
  }, [user, isLoading, needsBudgetSetup, inAuthGroup, inBudgetSetup]);

  if (isLoading || (!fontsLoaded && !fontError) || (!user && !inAuthGroup)) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={mode === 'night' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="budget-setup" options={{ headerShown: false }} />
        <Stack.Screen
          name="whatif"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>

      {!splashFinished && (
        <StartupSplashScreen onFinish={() => setSplashFinished(true)} />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <EnergyProvider>
            <AppNavigator />
          </EnergyProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
