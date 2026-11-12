// ==============================================================================
// SeedAccountsModal Component for KuryenTipid
// Allows quick testing of CAN validation with pre-seeded Meralco Customer Accounts
// ==============================================================================

import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DEFAULT_CUSTOMER_RECORDS } from '../services/authService';
import { CustomerRecord } from '../types/auth';
import { MeterClassificationBadge } from './MeterClassificationBadge';

interface SeedAccountsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAccount: (customer: CustomerRecord) => void;
}

export const SeedAccountsModal: React.FC<SeedAccountsModalProps> = ({
  visible,
  onClose,
  onSelectAccount,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Demo Meralco Accounts</Text>
              <Text style={styles.subtitle}>
                Tap any pre-seeded record to auto-fill for testing. Password: P@ssword123
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list}>
            {DEFAULT_CUSTOMER_RECORDS.map((item) => (
              <TouchableOpacity
                key={item.can}
                style={styles.card}
                onPress={() => {
                  onSelectAccount(item);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.accountName}>{item.accountHolderName}</Text>
                  <View style={styles.canBadge}>
                    <Text style={styles.canBadgeText}>CAN: {item.can}</Text>
                  </View>
                </View>
                {!!item.email && <Text style={styles.emailText}>Email: {item.email}</Text>}
                <Text style={styles.sinText}>SIN (on bill): {item.sin}</Text>
                <Text style={styles.addressText}>{item.serviceAddress}</Text>
                <View style={styles.tagRow}>
                  <MeterClassificationBadge
                    meterType={item.meterType || 'AMI'}
                    size="compact"
                    showSubtitle={false}
                  />
                  <Text style={styles.tag}>Budget: ₱{item.monthlyBudget}</Text>
                  <Text style={styles.tag}>{item.householdMembers} Members</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.dismissBtn} onPress={onClose}>
            <Text style={styles.dismissBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    maxWidth: 280,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
  },
  list: {
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fafaf9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  canBadge: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  canBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  emailText: {
    fontSize: 12,
    color: '#0284c7',
    fontWeight: '600',
    marginBottom: 2,
  },
  sinText: {
    fontSize: 12.5,
    color: '#ea580c',
    fontWeight: '600',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    fontSize: 11,
    color: '#334155',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dismissBtn: {
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
