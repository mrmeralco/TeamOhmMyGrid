// ==============================================================================
// PasswordStrengthMeter Component for KuryenTipid
// Real-time visual strength scoring and granular security rule indicators
// ==============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { evaluatePassword } from '../utils/validation';

interface PasswordStrengthMeterProps {
  password: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  if (!password) {
    return null;
  }

  const score = evaluatePassword(password);

  const getMeterColor = () => {
    switch (score.strengthLabel) {
      case 'Strong':
        return '#16a34a'; // green
      case 'Good':
        return '#0284c7'; // blue
      case 'Fair':
        return '#f59e0b'; // amber
      default:
        return '#dc2626'; // red
    }
  };

  const meterColor = getMeterColor();

  return (
    <View style={styles.container}>
      {/* Visual Bar Indicator */}
      <View style={styles.barHeader}>
        <Text style={styles.barTitle}>Password Strength</Text>
        <Text style={[styles.strengthBadge, { color: meterColor }]}>
          {score.strengthLabel}
        </Text>
      </View>

      <View style={styles.barsRow}>
        {[1, 2, 3, 4, 5].map((index) => {
          const isFilled = score.score >= index;
          return (
            <View
              key={index}
              style={[
                styles.segment,
                { backgroundColor: isFilled ? meterColor : '#e2e8f0' },
              ]}
            />
          );
        })}
      </View>

      {/* Checklist of Security Rules */}
      <View style={styles.checklist}>
        <RuleItem
          fulfilled={score.hasMinLength}
          label="At least 8 characters"
          required
        />
        <RuleItem
          fulfilled={score.hasLetter}
          label="Contains at least one letter (a-z, A-Z)"
          required
        />
        <RuleItem
          fulfilled={score.hasNumber}
          label="Contains at least one number (0-9)"
          required
        />
        <RuleItem
          fulfilled={score.hasUppercase}
          label="Contains uppercase letter"
          optional
        />
        <RuleItem
          fulfilled={score.hasSpecialChar}
          label="Contains special character (!@#$%^&*)"
          optional
        />
      </View>
    </View>
  );
};

const RuleItem: React.FC<{ fulfilled: boolean; label: string; required?: boolean; optional?: boolean }> = ({
  fulfilled,
  label,
  required,
  optional,
}) => (
  <View style={styles.ruleRow}>
    <Text style={[styles.ruleIcon, fulfilled ? styles.ruleIconDone : styles.ruleIconPending]}>
      {fulfilled ? '✓' : '○'}
    </Text>
    <Text style={[styles.ruleText, fulfilled && styles.ruleTextDone]}>
      {label}
      {required && <Text style={styles.requiredTag}> (Required)</Text>}
      {optional && <Text style={styles.optionalTag}> (Optional)</Text>}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  barTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  strengthBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  barsRow: {
    flexDirection: 'row',
    gap: 4,
    height: 5,
    marginBottom: 10,
  },
  segment: {
    flex: 1,
    borderRadius: 3,
  },
  checklist: {
    gap: 5,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleIcon: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  ruleIconDone: {
    color: '#16a34a',
  },
  ruleIconPending: {
    color: '#94a3b8',
  },
  ruleText: {
    fontSize: 12,
    color: '#64748b',
  },
  ruleTextDone: {
    color: '#1e293b',
    fontWeight: '500',
  },
  requiredTag: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '600',
  },
  optionalTag: {
    color: '#94a3b8',
    fontSize: 11,
  },
});
