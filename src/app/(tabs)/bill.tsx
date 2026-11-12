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
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useEnergy } from '../../context/EnergyContext';
import { BillVerificationDrawer } from '../../components/BillVerificationDrawer';
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { PageTransitionView } from '../../components/PageTransitionView';
import { parseMeralcoBillImage, buildBillExplanationPrompt } from '../../lib/geminiService';
import { ExtractedBillData } from '../../types';
import { formatCANDisplay } from '../../utils/validation';
import { MOCK_BILL_BREAKDOWN, MOCK_USER } from '../../constants/mockData';

export default function BillScreen() {
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';
  const { user } = useAuth();
  const { activeBill, setActiveBill, askTipi, activeCanProfile } = useEnergy();

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
    } catch (err: any) {
      Alert.alert(
        'Hindi Nabasa ang Bill',
        err?.message || 'Hindi mabasa ang detalye ng Meralco bill. Pakisubukan muli.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleManualInput = () => {
    setPendingBillData({
      customerAccountNumber: loggedInCan,
      billingPeriod: {
        startDate: activeBill?.billingPeriod?.startDate || '',
        endDate: activeBill?.billingPeriod?.endDate || '',
      },
      dueDate: activeBill?.dueDate || '',
      totalKwh: activeBill?.totalKwh || 0,
      totalAmountDue: activeBill?.totalAmountDue || 0,
      generationCharge: activeBill?.generationCharge,
      verifiedByUser: false,
    });
    setDrawerVisible(true);
  };

  const handleConfirmBill = (updated: ExtractedBillData) => {
    setActiveBill(updated);
    setDrawerVisible(false);
    Alert.alert('Tagumpay', 'Nai-save ang datos ng bill.');
  };

  const handleAskTipiAboutBill = () => {
    const prompt = buildBillExplanationPrompt({
      can: bill.customerAccountNumber,
      profileName: activeCanProfile?.name || 'Bahay',
      totalAmount,
      totalKwh: bill.totalKwh,
      dueDate: bill.dueDate,
      genCharge,
      distCharge,
      transCharge,
      taxCharge,
      language,
    });
    askTipi(prompt);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <PageTransitionView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.title, { color: theme.ink, fontSize: 24 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'Review ' : 'Suriin ang '}<Text style={{ color: '#FF6B00' }}>Bill</Text>
              </Text>
              <View style={[styles.canBadge, { backgroundColor: '#FF6B0014', borderColor: '#FF6B0033' }]}>
                <View style={styles.canIndicatorDot} />
                <Text style={[styles.canSubtitle, { color: '#D95200', fontSize: 11 * fontScale, fontFamily: 'Coolvetica' }]}>
                  CAN: {bill.customerAccountNumber} · {activeCanProfile?.name || 'Bahay'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <HeaderAlertButton from="bill" />
              <HeaderSettingsButton />
            </View>
          </View>

          {/* Bill Summary Card with Gradient Overlay */}
          <View style={[styles.billCard, { backgroundColor: theme.surface, borderColor: '#FF6B0035' }]}>
            <LinearGradient
              colors={['#FF6B000C', '#FFA04018']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
            />
            <View style={styles.pillLabel}>
              <Text style={[styles.labelBadge, { color: '#FF6B00', fontSize: 11 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'TOTAL AMOUNT DUE' : 'HALAGANG BABAYARAN'}
              </Text>
            </View>

            <Text style={[styles.amountDue, { color: theme.ink, fontSize: 32 * fontScale, fontFamily: 'Coolvetica' }]}>
              ₱{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>

            <View style={styles.metaRow}>
              <Text style={[styles.metaText, { color: theme.muted, fontSize: 13 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'Consumption: ' : 'Konsumo: '}<Text style={{ color: theme.ink, fontWeight: '700' }}>{bill.totalKwh} kWh</Text>
              </Text>
              <Text style={[styles.metaText, { color: theme.muted, fontSize: 13 * fontScale, fontFamily: 'Coolvetica' }]}>
                Due Date: <Text style={{ color: theme.ink, fontWeight: '700' }}>{bill.dueDate}</Text>
              </Text>
            </View>

            {/* Month-over-Month Comparison */}
            <View style={[styles.comparisonCard, { backgroundColor: theme.cont, borderColor: '#FF6B0024' }]}>
              <View style={styles.comparisonHeader}>
                <Text style={[styles.comparisonTitle, { color: theme.ink, fontSize: 13 * fontScale, fontFamily: 'Coolvetica' }]}>
                  {isEnglish ? 'Comparison vs Previous' : 'Paghahambing sa Nakaraan'}
                </Text>
                <View style={[styles.increaseBadge, { backgroundColor: theme.dangerBg, borderColor: theme.danger }]}>
                  <Text style={[styles.increaseBadgeText, { color: theme.danger, fontSize: 11 * fontScale, fontFamily: 'Coolvetica' }]}>
                    +{MOCK_BILL_BREAKDOWN.difference}
                  </Text>
                </View>
              </View>
              <Text style={[styles.comparisonText, { color: theme.muted, fontSize: 12 * fontScale }]}>
                {isEnglish ? 'Last month' : 'Nakaraang buwan'}: ₱{MOCK_BILL_BREAKDOWN.lastMonthTotal.toLocaleString()} · Rate delta: {MOCK_BILL_BREAKDOWN.rateChange}
              </Text>
            </View>

            {/* Components Breakdown */}
            <Text style={[styles.breakdownHeader, { color: theme.ink, fontSize: 14 * fontScale, fontFamily: 'Coolvetica' }]}>
              {isEnglish ? 'Components Breakdown' : 'Hati ng mga Gastusin'}
            </Text>

            <View style={styles.segmentedBar}>
              <View style={[styles.barSlice, { flex: 58, backgroundColor: '#FF4D26' }]} />
              <View style={[styles.barSlice, { flex: 19, backgroundColor: '#FF6B00' }]} />
              <View style={[styles.barSlice, { flex: 9, backgroundColor: '#FFA040' }]} />
              <View style={[styles.barSlice, { flex: 14, backgroundColor: '#8B5CF6' }]} />
            </View>

            {/* Breakdown Legend */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF4D26' }]} />
                <Text style={[styles.legendText, { color: theme.ink, fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                  Generation (58%): ₱{genCharge.toFixed(2)}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF6B00' }]} />
                <Text style={[styles.legendText, { color: theme.ink, fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                  Distribution (19%): ₱{distCharge.toFixed(2)}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FFA040' }]} />
                <Text style={[styles.legendText, { color: theme.ink, fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                  Transmission (9%): ₱{transCharge.toFixed(2)}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.legendText, { color: theme.ink, fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                  {isEnglish ? 'VAT & Others' : 'VAT at Iba Pa'} (14%): ₱{taxCharge.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryUploadBtn}
              onPress={handleScanWithCamera}
              disabled={analyzing}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Kumuha ng litrato ng Meralco bill gamit ang camera"
            >
              <LinearGradient
                colors={['#FF4D26', '#FF6B00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
              />
              {analyzing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={[styles.btnText, { color: '#ffffff', fontSize: 15 * fontScale, fontFamily: 'Coolvetica' }]}>
                  {isEnglish ? '📷 Scan Bill (OCR)' : '📷 I-scan ang Bill (OCR)'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryInputBtn, { backgroundColor: theme.surface, borderColor: '#FF6B0036' }]}
              onPress={handleManualInput}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.ink, fontSize: 14 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? '✏️ Manual Input' : '✏️ Manu-manong Input'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tipiHelpBtn, { backgroundColor: theme.surface, borderColor: '#FF6B002B' }]}
              onPress={handleAskTipiAboutBill}
              activeOpacity={0.8}
            >
              <Text style={[styles.tipiHelpText, { color: '#FF5500', fontSize: 14 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? '💬 Explain Line-by-Line with Tipi' : '💬 Ipaliwanag kay Tipi Line-by-Line'}
              </Text>
            </TouchableOpacity>
          </View>

          <BillVerificationDrawer
            visible={drawerVisible}
            data={pendingBillData}
            onConfirm={handleConfirmBill}
            onCancel={() => setDrawerVisible(false)}
          />

          <View style={{ height: 110 }} />
        </ScrollView>
      </PageTransitionView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 6 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  canBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginTop: 2,
  },
  canIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B00',
  },
  canSubtitle: {
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  billCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pillLabel: {
    backgroundColor: '#FF6B0014',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  labelBadge: {
    fontWeight: '400',
    letterSpacing: 0.8,
  },
  amountDue: {
    fontWeight: '400',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FF6B0018',
  },
  metaText: {
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  comparisonCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginVertical: 8,
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  comparisonTitle: {
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  increaseBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  increaseBadgeText: {
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  comparisonText: {
    fontWeight: '400',
    lineHeight: 16,
  },
  breakdownHeader: {
    fontWeight: '400',
    marginTop: 8,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  segmentedBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginVertical: 4,
  },
  barSlice: { height: '100%' },
  legendContainer: { marginTop: 10, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: {
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  actionsContainer: { marginTop: 12, gap: 10 },
  primaryUploadBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#FF4D26',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  btnText: {
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  secondaryInputBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryBtnText: {
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  tipiHelpBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipiHelpText: {
    fontWeight: '400',
    letterSpacing: 0.4,
  },
});
