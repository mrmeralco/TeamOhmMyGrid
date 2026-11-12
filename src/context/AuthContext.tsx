// ==============================================================================
// Authentication Context for KuryenTipid
// Provides global auth state, user profile, login, registration, and logout
// ==============================================================================

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getActiveSession,
  loginUser,
  logoutUser,
  registerUser,
  resetDatabaseToSeed,
} from '../services/authService';
import { AuthResponse, RegistrationFormData, UserProfile } from '../types/auth';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<AuthResponse<UserProfile>>;
  register: (data: RegistrationFormData) => Promise<AuthResponse<UserProfile>>;
  logout: () => Promise<void>;
  resetToDemoSeed: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = async () => {
    try {
      const session = await getActiveSession();
      setUser(session);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshSession();
  }, []);

  const login = async (identifier: string, pass: string): Promise<AuthResponse<UserProfile>> => {
    setUser(null);
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
  };

  const resetToDemoSeed = async () => {
    await resetDatabaseToSeed();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        resetToDemoSeed,
        refreshSession,
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
