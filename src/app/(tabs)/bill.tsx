import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useEnergy } from '../../context/EnergyContext';
import { BillVerificationDrawer } from '../../components/BillVerificationDrawer';
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { parseMeralcoBillImage } from '../../lib/geminiService';
import { ExtractedBillData } from '../../types';
import { formatCANDisplay } from '../../utils/validation';
import { MOCK_BILL_BREAKDOWN, MOCK_USER } from '../../constants/mockData';

export default function BillScreen() {
  const { theme, fontScale } = useTheme();
  const { user } = useAuth();
  const { activeBill, setActiveBill, addChatMessage, activeCanProfile } = useEnergy();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [pendingBillData, setPendingBillData] = useState<ExtractedBillData | null>(null);

  const loggedInCan =
    activeCanProfile?.accountNumber ||
    (user?.can ? formatCANDisplay(user.can) : null) ||
    activeBill?.customerAccountNumber ||
    MOCK_USER.accountNumber;

  const bill = activeBill || {
    customerAccountNumber: loggedInCan,
    billingPeriod: { startDate: '2026-04-15', endDate: '2026-05-14' },
    dueDate: '2026-05-25',
    totalKwh: 215,
    totalAmountDue: 2450.50,
    generationCharge: 1414.95,
    verifiedByUser: true,
  };

  const totalAmount = bill.totalAmountDue || 2450.50;
  const genCharge = bill.generationCharge || totalAmount * 0.58;
  const distCharge = totalAmount * 0.19;
  const transCharge = totalAmount * 0.09;
  const taxCharge = Math.max(0, totalAmount - (genCharge + distCharge + transCharge));

  const handleScanWithCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Pahintulot sa Kamera',
          'Kailangan ng pahintulot sa camera upang makuhanan ng litrato ang iyong Meralco bill.'
        );
        return;
      }

      let result: ImagePicker.ImagePickerResult;
      try {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          base64: true,
          quality: 0.8,
        });
      } catch {
        // Fallback for environments where camera is not available (e.g. desktop web)
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          base64: true,
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]?.base64) {
        setAnalyzing(true);
        const extracted = await parseMeralcoBillImage(result.assets[0].base64);
        setPendingBillData(extracted);
        setDrawerVisible(true);
      }
    } catch {
      Alert.alert('Paalala', 'Hindi nabuksan ang camera.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleManualInput = () => {
    setPendingBillData({
      ...bill,
      customerAccountNumber: loggedInCan,
    });
    setDrawerVisible(true);
  };

  const handleConfirmBill = (updated: ExtractedBillData) => {
    setActiveBill(updated);
    setDrawerVisible(false);
    Alert.alert('Tagumpay', 'Nai-save ang datos ng bill.');
  };

  const handleAskTipiAboutBill = () => {
    addChatMessage('user', 'Himayin ang Bill Line-by-Line 📋');
    router.push('/(tabs)/tanong');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <Text style={[styles.title, { color: theme.ink, fontSize: 24 * fontScale }]}>
              Suriin ang Bill
            </Text>
            <Text style={[styles.canSubtitle, { color: theme.muted, fontSize: 13 * fontScale }]}>
              CAN: {bill.customerAccountNumber} · {activeCanProfile?.name || 'Bahay'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HeaderAlertButton from="bill" />
            <HeaderSettingsButton />
          </View>
        </View>

        {/* Bill Summary Card */}
        <View style={[styles.billCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.amountDue, { color: theme.ink, fontSize: 32 * fontScale }]}>
            ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: theme.muted, fontSize: 13 * fontScale }]}>
              Konsumo: <Text style={{ color: theme.ink, fontWeight: '700' }}>{bill.totalKwh} kWh</Text>
            </Text>
            <Text style={[styles.metaText, { color: theme.muted, fontSize: 13 * fontScale }]}>
              Due Date: <Text style={{ color: theme.ink, fontWeight: '700' }}>{bill.dueDate}</Text>
            </Text>
          </View>

          {/* Month-over-Month Comparison */}
          <View style={[styles.comparisonCard, { backgroundColor: theme.cont }]}>
            <View style={styles.comparisonHeader}>
              <Text style={[styles.comparisonTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                Paghahambing sa Nakaraan
              </Text>
              <View style={[styles.increaseBadge, { backgroundColor: theme.dangerBg }]}>
                <Text style={[styles.increaseBadgeText, { color: theme.danger, fontSize: 11 * fontScale }]}>
                  +{MOCK_BILL_BREAKDOWN.difference}
                </Text>
              </View>
            </View>
            <Text style={[styles.comparisonText, { color: theme.muted, fontSize: 12 * fontScale }]}>
              Nakaraang buwan: ₱{MOCK_BILL_BREAKDOWN.lastMonthTotal.toLocaleString()} · Rate delta: {MOCK_BILL_BREAKDOWN.rateChange}
            </Text>
          </View>

          {/* Segmented Cost Breakdown Bar */}
          <Text style={[styles.breakdownHeader, { color: theme.ink, fontSize: 14 * fontScale }]}>
            Hati-hating Bayarin:
          </Text>
          <View style={styles.segmentedBar}>
            <View style={[styles.barSlice, { flex: 58, backgroundColor: theme.brand }]} />
            <View style={[styles.barSlice, { flex: 19, backgroundColor: theme.ok }]} />
            <View style={[styles.barSlice, { flex: 9, backgroundColor: theme.warn }]} />
            <View style={[styles.barSlice, { flex: 14, backgroundColor: theme.peak }]} />
          </View>

          {/* Breakdown Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.brand }]} />
              <Text style={[styles.legendText, { color: theme.ink, fontSize: 12 * fontScale }]}>
                Generation (58%): ₱{genCharge.toFixed(2)}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.ok }]} />
              <Text style={[styles.legendText, { color: theme.ink, fontSize: 12 * fontScale }]}>
                Distribution (19%): ₱{distCharge.toFixed(2)}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.warn }]} />
              <Text style={[styles.legendText, { color: theme.ink, fontSize: 12 * fontScale }]}>
                Transmission (9%): ₱{transCharge.toFixed(2)}
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.peak }]} />
              <Text style={[styles.legendText, { color: theme.ink, fontSize: 12 * fontScale }]}>
                VAT at Iba Pa (14%): ₱{taxCharge.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.primaryUploadBtn, { backgroundColor: theme.brand }]}
            onPress={handleScanWithCamera}
            disabled={analyzing}
            accessibilityRole="button"
            accessibilityLabel="Kumuha ng litrato ng Meralco bill gamit ang camera"
          >
            {analyzing ? (
              <ActivityIndicator color={theme.brandInk} />
            ) : (
              <Text style={[styles.btnText, { color: theme.brandInk, fontSize: 15 * fontScale }]}>
                📷 I-scan ang Bill (OCR)
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryInputBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
            onPress={handleManualInput}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.ink, fontSize: 14 * fontScale }]}>
              ✏️ Manu-manong Input
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tipiHelpBtn, { backgroundColor: theme.cont }]}
            onPress={handleAskTipiAboutBill}
          >
            <Text style={[styles.tipiHelpText, { color: theme.ink, fontSize: 14 * fontScale }]}>
              💬 Ipaliwanag kay Tipi Line-by-Line
            </Text>
          </TouchableOpacity>
        </View>

        <BillVerificationDrawer
          visible={drawerVisible}
          data={pendingBillData}
          onConfirm={handleConfirmBill}
          onCancel={() => setDrawerVisible(false)}
        />

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTextGroup: {
    flex: 1,
  },
  title: { fontWeight: '800' },
  canSubtitle: { fontWeight: '600', marginTop: 2 },
  billCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 6,
  },
  amountDue: { fontWeight: '800', marginBottom: 4 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  metaText: { fontWeight: '500' },
  comparisonCard: {
    borderRadius: 10,
    padding: 8,
    marginVertical: 6,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  comparisonTitle: {
    fontWeight: '700',
  },
  increaseBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  increaseBadgeText: {
    fontWeight: '800',
  },
  comparisonText: {
    fontWeight: '500',
  },
  breakdownHeader: { fontWeight: '700', marginTop: 8, marginBottom: 6 },
  segmentedBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginVertical: 4,
  },
  barSlice: { height: '100%' },
  legendContainer: { marginTop: 8, gap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontWeight: '600' },
  actionsContainer: { marginTop: 10, gap: 8 },
  primaryUploadBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '700' },
  secondaryInputBtn: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontWeight: '700' },
  tipiHelpBtn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipiHelpText: { fontWeight: '700' },
});
