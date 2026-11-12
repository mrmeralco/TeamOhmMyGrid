// ==============================================================================
// KuryenTipid - Authentication and User Types (Updated)
// ==============================================================================

export type IdentifierType = 'email' | 'username' | 'can' | 'invalid';

export interface CustomerRecord {
  can: string;
  sin: string;
  accountHolderName: string;
  serviceAddress: string;
  rateClass: string;
  monthlyBudget: number;
  householdMembers: number;
  majorAppliances: string[];
  isRegistered: boolean;
  registeredAt?: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  can: string;
  sin: string;
  avatarUrl?: string;
  serviceAddress?: string;
  householdMembers: number;
  majorAppliances: string[];
  monthlyBudget: number;
  isEmailVerified: boolean;
  createdAt: string;
}

export interface RegistrationFormData {
  fullName: string;
  username: string;
  email: string;
  can?: string;
  password: string;
  confirmPassword: string;
}

export interface LoginFormData {
  identifier: string;
  password: string;
}

export interface OTPRecord {
  email: string;
  otp: string;
  expiresAt: number; // Unix timestamp ms
  attempts: number;
  userId: string;
  can: string;
  sin: string;
}

export interface ValidationRuleResult {
  isValid: boolean;
  message?: string;
}

export interface FieldValidationState {
  isValid: boolean;
  isChecking?: boolean;
  error?: string;
  success?: string;
}

export interface PasswordScore {
  hasMinLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasUppercase: boolean;
  hasSpecialChar: boolean;
  score: number;
  strengthLabel: 'Weak' | 'Fair' | 'Good' | 'Strong';
}

export interface RateLimitStatus {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  message?: string;
}

export interface AuthResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  otp?: string; // Simulated OTP for display (no SMTP)
}
