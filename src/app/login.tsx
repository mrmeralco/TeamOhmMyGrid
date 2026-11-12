// ==============================================================================
// Screen 2: Login
// Follows the layout of Image 2, with Multi-Identifier Login (Username/Email/CAN),
// Anti-Enumeration generic errors, Rate Limiting, and Social icons
// ==============================================================================

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SeedAccountsModal } from '../components/SeedAccountsModal';
import { SocialButtons } from '../components/SocialButtons';
import { useAuth } from '../context/AuthContext';
import { CustomerRecord } from '../types/auth';
import { detectIdentifierType, validateLoginIdentifier } from '../utils/validation';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isFocusedId, setIsFocusedId] = useState(false);
  const [isFocusedPass, setIsFocusedPass] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState<number | null>(null);
  const [seedModalVisible, setSeedModalVisible] = useState(false);

  // Active identifier type detection
  const detectedType = detectIdentifierType(identifier);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutTimer === null || lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setErrorMsg(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const getIdentifierBadge = () => {
    if (!identifier.trim()) return null;
    switch (detectedType) {
      case 'email':
        return { label: '✉️ Email', color: '#0284c7' };
      case 'can':
        return { label: '💳 Meralco CAN (10 Digits)', color: '#ea580c' };
      case 'username':
        return { label: '👤 Username', color: '#16a34a' };
      default:
        return null;
    }
  };

  const badge = getIdentifierBadge();

  const handleLogin = async () => {
    if (lockoutTimer && lockoutTimer > 0) return;

    setErrorMsg(null);

    const idVal = validateLoginIdentifier(identifier);
    if (!idVal.isValid) {
      setErrorMsg(idVal.message || 'Please enter a valid Email, Username, or CAN.');
      return;
    }

    if (!password) {
      setErrorMsg('Password is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await login(identifier, password);
      if (res.success) {
        router.replace('/(tabs)');
      } else {
        if (res.rateLimited && res.retryAfterSeconds) {
          setLockoutTimer(res.retryAfterSeconds);
        }
        // Generic error message preventing account enumeration
        setErrorMsg(
          res.error || 'Invalid credentials. Please verify your identifier and password.'
        );
      }
    } catch {
      setErrorMsg('Invalid credentials. Please verify your identifier and password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectSeedAccount = (customer: CustomerRecord) => {
    setIdentifier(customer.can);
    setPassword('P@ssword123');
    setErrorMsg(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.pageBackground}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.phoneCard}>
          {/* Header matching Image 2 */}
          <View style={styles.header}>
            <Text style={styles.title}>Login here</Text>
            <Text style={styles.subtitleBold}>Welcome back</Text>
            <Text style={styles.subtitleBold}>to KuryenTipid!</Text>
          </View>

          {/* Rate Limit Alert */}
          {lockoutTimer !== null && lockoutTimer > 0 && (
            <View style={styles.lockoutBanner}>
              <Text style={styles.lockoutTitle}>🛡️ Rate Limit Active</Text>
              <Text style={styles.lockoutText}>
                Too many failed attempts. Please wait{' '}
                <Text style={styles.lockoutCountdown}>
                  {Math.floor(lockoutTimer / 60)}:
                  {(lockoutTimer % 60).toString().padStart(2, '0')}
                </Text>{' '}
                before retrying.
              </Text>
            </View>
          )}

          {/* Error Banner */}
          {errorMsg && (!lockoutTimer || lockoutTimer <= 0) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {errorMsg}</Text>
            </View>
          )}

          {/* Identifier Input */}
          <View style={styles.fieldGroup}>
            <View
              style={[
                styles.inputWrapper,
                isFocusedId && styles.inputFocused,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Email, Username, or CAN"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                autoCorrect={false}
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (errorMsg) setErrorMsg(null);
                }}
                onFocus={() => setIsFocusedId(true)}
                onBlur={() => setIsFocusedId(false)}
              />
              {badge && (
                <Text style={[styles.inlineBadge, { color: badge.color }]}>{badge.label}</Text>
              )}
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.fieldGroup}>
            <View
              style={[
                styles.inputWrapper,
                isFocusedPass && styles.inputFocused,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errorMsg) setErrorMsg(null);
                }}
                onFocus={() => setIsFocusedPass(true)}
                onBlur={() => setIsFocusedPass(false)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                activeOpacity={0.7}
              >
                <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPasswordRow}
            onPress={() => alert('Password recovery link has been sent to your registered email.')}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotPasswordText}>Forgot your password?</Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[
              styles.signInBtn,
              (isSubmitting || (lockoutTimer !== null && lockoutTimer > 0)) &&
                styles.signInBtnDisabled,
            ]}
            onPress={handleLogin}
            disabled={isSubmitting || (lockoutTimer !== null && lockoutTimer > 0)}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signInBtnText}>Sign in</Text>
            )}
          </TouchableOpacity>

          {/* Create new account link */}
          <TouchableOpacity
            style={styles.createAccountRow}
            onPress={() => router.replace('/register')}
            activeOpacity={0.7}
          >
            <Text style={styles.createAccountText}>Create new account</Text>
          </TouchableOpacity>

          {/* Demo Meralco Accounts Quick Picker */}
          <TouchableOpacity
            style={styles.demoAccountsBtn}
            onPress={() => setSeedModalVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.demoAccountsBtnText}>⚡ Demo Meralco Accounts (Quick Fill)</Text>
          </TouchableOpacity>

          {/* Social Sign-in section matching Image 2 */}
          <SocialButtons
            onPressProvider={(provider) =>
              alert(`Social login with ${provider} will sync with your Meralco account.`)
            }
          />
        </View>
      </ScrollView>

      <SeedAccountsModal
        visible={seedModalVisible}
        onClose={() => setSeedModalVisible(false)}
        onSelectAccount={handleSelectSeedAccount}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#faf2ec',
  },
  pageBackground: {
    flexGrow: 1,
    backgroundColor: '#faf2ec',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  phoneCard: {
    backgroundColor: '#ffffff',
    borderRadius: 36,
    paddingVertical: 36,
    paddingHorizontal: 26,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ea580c',
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  subtitleBold: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 220,
  },
  lockoutBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  lockoutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#b91c1c',
    marginBottom: 2,
  },
  lockoutText: {
    fontSize: 12,
    color: '#7f1d1d',
  },
  lockoutCountdown: {
    fontWeight: 'bold',
    color: '#b91c1c',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    color: '#991b1b',
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  inputFocused: {
    borderColor: '#ea580c',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: '#0f172a',
    paddingVertical: 12,
    outlineStyle: 'none' as any,
  },
  inlineBadge: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  eyeBtn: {
    padding: 6,
  },
  eyeText: {
    fontSize: 16,
  },
  forgotPasswordRow: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -4,
  },
  forgotPasswordText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ea580c',
  },
  signInBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 16,
  },
  signInBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  createAccountRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  createAccountText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569',
  },
  demoAccountsBtn: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  demoAccountsBtnText: {
    color: '#D95200',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
