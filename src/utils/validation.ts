// ==============================================================================
// Validation Rules & Security Helpers
// Strict matching of both Frontend and Server-Side Validation Specifications
// ==============================================================================

import { IdentifierType, PasswordScore, ValidationRuleResult } from '../types/auth';

/**
 * 1. Full Name Validation:
 * - Required text field
 * - Alphabetic characters and spaces only
 * - Minimum 2 characters
 */
export function validateFullName(name: string): ValidationRuleResult {
  if (!name || name.trim().length === 0) {
    return { isValid: false, message: 'Full name is required.' };
  }

  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { isValid: false, message: 'Full name must be at least 2 characters.' };
  }

  if (trimmed.length > 80) {
    return { isValid: false, message: 'Full name cannot exceed 80 characters.' };
  }

  // Alphabetic characters (A-Z, a-z) and spaces only
  const alphaRegex = /^[A-Za-z\s]+$/;
  if (!alphaRegex.test(trimmed)) {
    return {
      isValid: false,
      message: 'Full name must contain alphabetic characters and spaces only.',
    };
  }

  return { isValid: true };
}

/**
 * 2. Username Validation:
 * - Required unique identifier
 * - Alphanumeric (A-Z, a-z, 0-9)
 * - 4–20 characters
 * - No spaces or special characters
 */
export function validateUsername(username: string): ValidationRuleResult {
  if (!username || username.trim().length === 0) {
    return { isValid: false, message: 'Username is required.' };
  }

  const trimmed = username.trim();

  if (trimmed.length < 4 || trimmed.length > 20) {
    return { isValid: false, message: 'Username must be between 4 and 20 characters.' };
  }

  if (/\s/.test(trimmed)) {
    return { isValid: false, message: 'Username cannot contain spaces.' };
  }

  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  if (!alphanumericRegex.test(trimmed)) {
    return { isValid: false, message: 'Username must be alphanumeric (letters and numbers only).' };
  }

  return { isValid: true };
}

/**
 * 3. Email Address Validation:
 * - Required unique field
 * - Must follow standard email formatting (user@domain.com)
 */
export function validateEmail(email: string): ValidationRuleResult {
  if (!email || email.trim().length === 0) {
    return { isValid: false, message: 'Email address is required.' };
  }

  const trimmed = email.trim();

  // Standard RFC 5322 compatible email regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { isValid: false, message: 'Please enter a valid email address (e.g., user@domain.com).' };
  }

  return { isValid: true };
}

/**
 * 4. Customer and Account Number (CAN) Validation:
 * - Format: Exactly 10 numeric digits
 * - Normalizes away spaces and hyphens (e.g. "1234-5678-90" -> "1234567890")
 */
export function cleanCAN(can: string): string {
  return can.replace(/\D/g, '');
}

export function formatCANDisplay(can: string): string {
  const digits = cleanCAN(can);
  if (digits.length <= 4) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 10)}`;
}

export function validateCAN(can: string): ValidationRuleResult {
  if (!can || can.trim().length === 0) {
    return { isValid: false, message: 'Customer and Account Number (CAN) is required.' };
  }

  const digits = cleanCAN(can);

  if (digits.length === 0) {
    return { isValid: false, message: 'CAN must contain numeric digits only.' };
  }

  if (digits.length !== 10) {
    return {
      isValid: false,
      message: `CAN must be exactly 10 numeric digits (${digits.length}/10 entered).`,
    };
  }

  return { isValid: true };
}

/**
 * 5. Password Validation:
 * - Required field
 * - Minimum 8 characters
 * - Must contain at least one letter and one number
 * - Enhanced indicators: Uppercase and special character support
 */
export function evaluatePassword(password: string): PasswordScore {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

  let score = 0;
  if (hasMinLength) score++;
  if (hasLetter) score++;
  if (hasNumber) score++;
  if (hasUppercase) score++;
  if (hasSpecialChar) score++;

  let strengthLabel: 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Weak';
  if (score >= 5) strengthLabel = 'Strong';
  else if (score >= 4) strengthLabel = 'Good';
  else if (score >= 3) strengthLabel = 'Fair';
  else strengthLabel = 'Weak';

  return {
    hasMinLength,
    hasLetter,
    hasNumber,
    hasUppercase,
    hasSpecialChar,
    score,
    strengthLabel,
  };
}

export function validatePassword(password: string): ValidationRuleResult {
  if (!password) {
    return { isValid: false, message: 'Password is required.' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }

  if (!/[a-zA-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one letter.' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number.' };
  }

  return { isValid: true };
}

/**
 * 6. Confirm Password Validation:
 * - Must match password field exactly
 */
export function validateConfirmPassword(password: string, confirmPassword: string): ValidationRuleResult {
  if (!confirmPassword) {
    return { isValid: false, message: 'Please confirm your password.' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, message: 'Passwords do not match.' };
  }

  return { isValid: true };
}

/**
 * 7. Login Identifier Detection & Validation:
 * Allows logging in via Username, Email, OR CAN (Customer Account Number)
 */
export function detectIdentifierType(input: string): IdentifierType {
  const trimmed = input.trim();
  const digits = cleanCAN(trimmed);

  // Email check
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return 'email';
  }

  // 10-digit CAN check
  if (digits.length === 10 && (trimmed.length === 10 || /^\d{4}-\d{4}-\d{2}$/.test(trimmed))) {
    return 'can';
  }

  // Alphanumeric Username check
  if (/^[a-zA-Z0-9]{4,20}$/.test(trimmed)) {
    return 'username';
  }

  return 'invalid';
}

export function validateLoginIdentifier(identifier: string): ValidationRuleResult {
  if (!identifier || identifier.trim().length === 0) {
    return { isValid: false, message: 'Username, Email, or Account Number is required.' };
  }

  const type = detectIdentifierType(identifier);
  if (type === 'invalid') {
    return {
      isValid: false,
      message: 'Enter a valid Email, 4-20 char Username, or 10-digit Account Number (CAN).',
    };
  }

  return { isValid: true };
}
