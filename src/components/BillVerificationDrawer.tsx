import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ExtractedBillData } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { formatCANDisplay } from '../utils/validation';
import { MOCK_USER } from '../constants/mockData';

interface BillVerificationDrawerProps {
  visible: boolean;
  data: ExtractedBillData | null;
  onConfirm: (data: ExtractedBillData) => void;
  onCancel: () => void;
}

export const BillVerificationDrawer: React.FC<BillVerificationDrawerProps> = ({
  visible,
  data,
  onConfirm,
  onCancel,
}) => {
  const { theme, fontScale } = useTheme();
  const { user } = useAuth();

  const [can, setCan] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [totalKwh, setTotalKwh] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [generationCharge, setGenerationCharge] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setValidationError('');
    if (data) {
      setCan(data.customerAccountNumber || (user?.can ? formatCANDisplay(user.can) : ''));
      setStartDate(data.billingPeriod?.startDate || '');
      setEndDate(data.billingPeriod?.endDate || '');
      setDueDate(data.dueDate || '');
      setTotalKwh(
        typeof data.totalKwh === 'number' && data.totalKwh > 0 ? data.totalKwh.toString() : ''
      );
      setTotalAmount(
        typeof data.totalAmountDue === 'number' && data.totalAmountDue > 0
          ? data.totalAmountDue.toString()
          : ''
      );
      setGenerationCharge(
        typeof data.generationCharge === 'number' && data.generationCharge > 0
          ? data.generationCharge.toString()
          : ''
      );
    } else {
      setCan(user?.can ? formatCANDisplay(user.can) : '');
      setStartDate('');
      setEndDate('');
      setDueDate('');
      setTotalKwh('');
      setTotalAmount('');
      setGenerationCharge('');
    }
  }, [data, user?.can]);

  const handleSave = () => {
    const canDigits = can.replace(/\D/g, '');
    const kwhVal = parseFloat(totalKwh);
    const amountVal = parseFloat(totalAmount);
    const genVal = generationCharge.trim() ? parseFloat(generationCharge) : undefined;

    if (canDigits.length < 10) {
      setValidationError('Ilagay ang wastong 10-12 digit Customer Account Number (CAN).');
      return;
    }
    if (!Number.isFinite(kwhVal) || kwhVal <= 0) {
      setValidationError('Ilagay ang wastong Kabuuang Konsumo (kWh).');
      return;
    }
    if (!Number.isFinite(amountVal) || amountVal <= 0) {
      setValidationError('Ilagay ang wastong Halaga ng Bill (₱).');
      return;
    }
    if (!dueDate.trim()) {
      setValidationError('Ilagay ang Due Date ng bill (YYYY-MM-DD).');
      return;
    }

    setValidationError('');
    const updated: ExtractedBillData = {
      customerAccountNumber: can.trim(),
      billingPeriod: {
        startDate: startDate.trim(),
        endDate: endDate.trim(),
      },
      dueDate: dueDate.trim(),
      totalKwh: kwhVal,
      totalAmountDue: amountVal,
      generationCharge: genVal !== undefined && Number.isFinite(genVal) ? genVal : undefined,
      verifiedByUser: true,
    };
    onConfirm(updated);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.ink, fontSize: 20 * fontScale }]}>
              Suriin ang Detalye ng Bill
            </Text>
            <Text style={[styles.subtitle, { color: theme.muted, fontSize: 13 * fontScale }]}>
              I-verify o iwasto ang nabasang impormasyon mula sa Meralco bill
            </Text>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* CAN */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 14 * fontScale }]}>
                Customer Account Number (CAN)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.line,
                    color: theme.ink,
                    fontSize: 15 * fontScale,
                  },
                ]}
                value={can}
                onChangeText={setCan}
                placeholder={MOCK_USER.accountNumber}
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
              />
            </View>

            {/* Total kWh */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 14 * fontScale }]}>
                Kabuuang Konsumo (kWh)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.line,
                    color: theme.ink,
                    fontSize: 15 * fontScale,
                  },
                ]}
                value={totalKwh}
                onChangeText={setTotalKwh}
                placeholder="Hal. 215"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
              />
            </View>

            {/* Total Amount Due */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 14 * fontScale }]}>
                Halaga ng Bill (₱)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.line,
                    color: theme.ink,
                    fontSize: 15 * fontScale,
                  },
                ]}
                value={totalAmount}
                onChangeText={setTotalAmount}
                placeholder="Hal. 2450.50"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
              />
            </View>

            {/* Generation Charge */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 14 * fontScale }]}>
                Generation Charge (₱)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.line,
                    color: theme.ink,
                    fontSize: 15 * fontScale,
                  },
                ]}
                value={generationCharge}
                onChangeText={setGenerationCharge}
                placeholder="Hal. 1414.95"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
              />
            </View>

            {/* Dates Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 * fontScale }]}>
                  Start Date
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.line,
                      color: theme.ink,
                      fontSize: 14 * fontScale,
                    },
                  ]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.muted}
                />
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 * fontScale }]}>
                  End Date
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.line,
                      color: theme.ink,
                      fontSize: 14 * fontScale,
                    },
                  ]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.muted}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 * fontScale }]}>
                Due Date
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.bg,
                    borderColor: theme.line,
                    color: theme.ink,
                    fontSize: 14 * fontScale,
                  },
                ]}
                value={dueDate}
                onChangeText={setDueDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.muted}
              />
            </View>

            {validationError ? (
              <Text style={{ color: theme.danger, fontSize: 12.5 * fontScale, fontWeight: '600', marginTop: 4 }}>
                {validationError}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.line }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelText, { color: theme.ink, fontSize: 15 * fontScale }]}>
                Kanselahin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: theme.brand }]}
              onPress={handleSave}
            >
              <Text
                style={[styles.confirmText, { color: theme.brandInk, fontSize: 15 * fontScale }]}
              >
                Kumpirmahin
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 4,
  },
  body: {
    marginVertical: 8,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontWeight: '700',
  },
});
