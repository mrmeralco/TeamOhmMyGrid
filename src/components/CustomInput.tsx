// ==============================================================================
// CustomInput Component for KuryenTipid
// Modern, high-accessibility input with real-time inline validation feedback
// ==============================================================================

import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';

interface CustomInputProps extends TextInputProps {
  label: string;
  icon?: string;
  error?: string;
  success?: string;
  helperText?: string;
  isValid?: boolean;
  isChecking?: boolean;
  isPassword?: boolean;
  required?: boolean;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  icon,
  error,
  success,
  helperText,
  isValid,
  isChecking = false,
  isPassword = false,
  required = false,
  value,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasError = Boolean(error);
  const showSuccess = Boolean(success) || (isValid && !hasError && value && value.length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.requiredAsterisk}>*</Text>}
        </Text>
        {isChecking && (
          <View style={styles.statusBadge}>
            <ActivityIndicator size="small" color="#ea580c" />
            <Text style={styles.checkingText}>Checking...</Text>
          </View>
        )}
        {!isChecking && showSuccess && (
          <View style={[styles.statusBadge, styles.badgeSuccess]}>
            <Text style={styles.badgeSuccessText}>✓ Valid</Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          showSuccess && !hasError && styles.inputSuccess,
        ]}
      >
        {icon && <Text style={styles.leadingIcon}>{icon}</Text>}

        <TextInput
          style={[styles.input, isPassword && styles.passwordInput]}
          placeholderTextColor="#94a3b8"
          secureTextEntry={isPassword && !showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          value={value}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            activeOpacity={0.7}
          >
            <Text style={styles.eyeText}>{showPassword ? '🙈 Hide' : '👁️ Show'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Error Message */}
      {hasError && (
        <View style={styles.feedbackRow}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Success details message */}
      {!hasError && success && (
        <View style={styles.feedbackRow}>
          <Text style={styles.successText}>✓ {success}</Text>
        </View>
      )}

      {/* Helper text */}
      {!hasError && !success && helperText && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  requiredAsterisk: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  checkingText: {
    fontSize: 11,
    color: '#ea580c',
    fontWeight: '500',
  },
  badgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  badgeSuccessText: {
    fontSize: 11,
    color: '#15803d',
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  inputFocused: {
    borderColor: '#ea580c',
    backgroundColor: '#fffaf5',
    shadowColor: '#ea580c',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  inputSuccess: {
    borderColor: '#22c55e',
  },
  leadingIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    paddingVertical: 10,
    outlineStyle: 'none' as any, // for web clean outline
  },
  passwordInput: {
    paddingRight: 8,
  },
  eyeButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  eyeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  feedbackRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12.5,
    color: '#b91c1c',
    fontWeight: '500',
    lineHeight: 16,
  },
  successText: {
    fontSize: 12.5,
    color: '#15803d',
    fontWeight: '500',
    lineHeight: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
});
