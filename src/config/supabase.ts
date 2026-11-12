// ==============================================================================
// Supabase Configuration & Client Initialization
// Supports both Live Supabase and seamless Mock/Local Engine for immediate testing
// ==============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Supabase environment variables
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Detect if valid remote Supabase credentials have been configured
export const isLiveSupabaseConfigured = (): boolean => {
  return (
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('your-project') &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes('your-anon-key')
  );
};

// Initialize Supabase Client with React Native AsyncStorage session persistence
const isServerRender = Platform.OS === 'web' && typeof window === 'undefined';
export const supabase: SupabaseClient | null = isLiveSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: isServerRender ? undefined : AsyncStorage,
        autoRefreshToken: !isServerRender,
        persistSession: !isServerRender,
        detectSessionInUrl: false,
      },
    })
  : null;

// Password validation must never establish the app's persistent session.
export function createPasswordCheckClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      storageKey: 'kuryentipid-password-check' },
  });
}
