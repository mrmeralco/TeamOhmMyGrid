// ==============================================================================
// SocialButtons Component for KuryenTipid
// Renders the "Or continue with" section and social icon buttons matching Image 2
// ==============================================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SocialButtonsProps {
  onPressProvider?: (provider: 'google' | 'facebook' | 'apple') => void;
}

export const SocialButtons: React.FC<SocialButtonsProps> = ({ onPressProvider }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.orText}>Or continue with</Text>

      <View style={styles.iconsRow}>
        {/* Google */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => onPressProvider && onPressProvider('google')}
          activeOpacity={0.7}
          accessibilityLabel="Continue with Google"
        >
          <Text style={styles.googleText}>G</Text>
        </TouchableOpacity>

        {/* Facebook */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => onPressProvider && onPressProvider('facebook')}
          activeOpacity={0.7}
          accessibilityLabel="Continue with Facebook"
        >
          <Text style={styles.facebookText}>f</Text>
        </TouchableOpacity>

        {/* Apple */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => onPressProvider && onPressProvider('apple')}
          activeOpacity={0.7}
          accessibilityLabel="Continue with Apple"
        >
          <Text style={styles.appleText}></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    width: '100%',
  },
  orText: {
    fontSize: 13,
    color: '#ea580c',
    fontWeight: '600',
    marginBottom: 16,
  },
  iconsRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  googleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  facebookText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1877f2',
    fontFamily: 'sans-serif',
  },
  appleText: {
    fontSize: 20,
    color: '#0f172a',
  },
});
