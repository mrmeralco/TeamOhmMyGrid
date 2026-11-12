// ==============================================================================
// EmailDeliveryModal Component for KuryenTipid
// Displays official Meralco Email Notification sent to user's registered email
// containing their Customer Account Number (CAN) and login instructions
// ==============================================================================

import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { UserProfile } from '../types/auth';

interface EmailDeliveryModalProps {
  visible: boolean;
  user: UserProfile | null;
  onProceed: () => void;
}

export const EmailDeliveryModal: React.FC<EmailDeliveryModalProps> = ({
  visible,
  user,
  onProceed,
}) => {
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onProceed}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Email Envelope Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>✉️</Text>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Verified: {user.email}</Text>
              </View>
            </View>
            <Text style={styles.title}>Email verified!</Text>
            <Text style={styles.subtitle}>
              Your linked Customer Account Number (CAN) is shown below.
            </Text>
          </View>

          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
            {/* Realistic Email Letter Box */}
            <View style={styles.emailContainer}>
              <View style={styles.emailTopBar}>
                <Text style={styles.senderText}>
                  <Text style={styles.senderBold}>From:</Text> KuryenTipid
                </Text>
                <Text style={styles.senderText}>
                  <Text style={styles.senderBold}>To:</Text> {user.email}
                </Text>
                <Text style={styles.senderText}>
                  <Text style={styles.senderBold}>Subject:</Text> Your Meralco Customer Account Number (CAN)
                </Text>
              </View>

              <View style={styles.emailLetterContent}>
                <Text style={styles.greeting}>Magandang araw, {user.fullName}!</Text>
                <Text style={styles.letterText}>
                  Salamat sa pag-sign up sa <Text style={styles.boldText}>KuryenTipid</Text>.
                  Ang iyong opisyal na Meralco Customer Account Number (CAN) para sa iyong service address ay matagumpay na nai-link:
                </Text>

                {/* Highlighted CAN Box */}
                <View style={styles.canHighlightBox}>
                  <Text style={styles.canLabel}>MERALCO CUSTOMER ACCOUNT NUMBER (CAN)</Text>
                  <Text style={styles.canNumber}>{user.can}</Text>
                  <Text style={styles.sinLabel}>SIN: {user.sin}</Text>

                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={handleCopy}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.copyBtnText}>
                      {copied ? '✓ Copied to clipboard!' : '📋 Copy CAN Number'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Login hint banner */}
                <View style={styles.loginHintBox}>
                  <Text style={styles.loginHintTitle}>💡 Paano mag-log in:</Text>
                  <Text style={styles.loginHintText}>
                    Maaari ka nang mag-log in gamit ang:
                  </Text>
                  <Text style={styles.loginBullet}>• Iyong CAN: <Text style={styles.boldText}>{user.can}</Text></Text>
                  <Text style={styles.loginBullet}>• Iyong Username: <Text style={styles.boldText}>@{user.username}</Text></Text>
                  <Text style={styles.loginBullet}>• Iyong Email: <Text style={styles.boldText}>{user.email}</Text></Text>
                </View>

                <Text style={styles.letterFooter}>
                  Manila Electric Company (MERALCO) · KuryenTipid Smart Energy Assistant
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.proceedBtn}
            onPress={onProceed}
            activeOpacity={0.8}
          >
            <Text style={styles.proceedBtnText}>Magpatuloy sa Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffedd5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  iconEmoji: {
    fontSize: 32,
  },
  badgeRow: {
    marginBottom: 6,
  },
  badge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#15803d',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  bodyScroll: {
    marginBottom: 16,
  },
  emailContainer: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    overflow: 'hidden',
  },
  emailTopBar: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 2,
  },
  senderText: {
    fontSize: 11.5,
    color: '#475569',
  },
  senderBold: {
    fontWeight: '700',
    color: '#1e293b',
  },
  emailLetterContent: {
    padding: 16,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  letterText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 14,
  },
  boldText: {
    fontWeight: '700',
    color: '#0f172a',
  },
  canHighlightBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#ea580c',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  canLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#c2410c',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  canNumber: {
    fontSize: 30,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 2,
    marginBottom: 2,
  },
  sinLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7c2d12',
    marginBottom: 12,
  },
  copyBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  copyBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  loginHintBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  loginHintTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  loginHintText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  loginBullet: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
  letterFooter: {
    fontSize: 10.5,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  proceedBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  proceedBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
