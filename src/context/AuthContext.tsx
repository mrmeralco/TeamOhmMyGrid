// ==============================================================================
// Authentication Context for KuryenTipid
// Provides global auth state, user profile, login, registration, and logout
// ==============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import { isLiveSupabaseConfigured, supabase } from '../config/supabase';
import {
  clearPendingBudgetSetup,
  getActiveSession,
  hasPendingBudgetSetup,
  loginUser,
  logoutUser,
  registerUser,
  resetDatabaseToSeed,
  updateUserMonthlyBudget,
} from '../services/authService';
import { AuthResponse, RegistrationFormData, UserProfile } from '../types/auth';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  needsBudgetSetup: boolean;
  login: (identifier: string, pass: string) => Promise<AuthResponse<UserProfile>>;
  register: (data: RegistrationFormData) => Promise<AuthResponse<UserProfile>>;
  logout: () => Promise<void>;
  resetToDemoSeed: () => Promise<void>;
  refreshSession: () => Promise<void>;
  completeBudgetSetup: (monthlyBudget: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [needsBudgetSetup, setNeedsBudgetSetup] = useState<boolean>(false);

  const refreshSession = async () => {
    try {
      const session = await getActiveSession();
      setUser(session);
      if (session?.id) {
        const pending = await hasPendingBudgetSetup(session.id);
        setNeedsBudgetSetup(pending);
      } else {
        setNeedsBudgetSetup(false);
      }
    } catch {
      setUser(null);
      setNeedsBudgetSetup(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();

    if (!isLiveSupabaseConfigured() || !supabase) return;
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser((prev) => {
          const isDevDemo =
            typeof __DEV__ !== 'undefined' && __DEV__ && prev?.id === 'demo-user-1234567890';
          return isDevDemo ? prev : null;
        });
      } else if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        refreshSession();
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const login = async (identifier: string, pass: string): Promise<AuthResponse<UserProfile>> => {
    const res = await loginUser(identifier, pass);
    if (res.success && res.data?.isEmailVerified) {
      setUser(res.data);
    }
    return res;
  };

  const register = async (data: RegistrationFormData): Promise<AuthResponse<UserProfile>> => {
    const res = await registerUser(data);
    if (res.success && res.data?.isEmailVerified) {
      setUser(res.data);
    }
    return res;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setNeedsBudgetSetup(false);
  };

  const resetToDemoSeed = async () => {
    await resetDatabaseToSeed();
    setUser(null);
    setNeedsBudgetSetup(false);
  };

  const completeBudgetSetup = async (monthlyBudget: number) => {
    if (user?.id) {
      await updateUserMonthlyBudget(user.id, monthlyBudget);
      await clearPendingBudgetSetup(user.id);
      setUser((prev) => (prev ? { ...prev, monthlyBudget } : prev));
    }
    setNeedsBudgetSetup(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        needsBudgetSetup,
        login,
        register,
        logout,
        resetToDemoSeed,
        refreshSession,
        completeBudgetSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
