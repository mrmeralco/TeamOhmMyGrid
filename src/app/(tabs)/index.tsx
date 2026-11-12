import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useEnergy } from '../../context/EnergyContext';
import { BudgetGauge } from '../../components/BudgetGauge';
import { UsageAnalysisCard } from '../../components/UsageAnalysisCard';
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { MeterClassificationBadge } from '../../components/MeterClassificationBadge';
import { PageTransitionView } from '../../components/PageTransitionView';
import { AmiCurveGraphCard } from '../../components/AmiCurveGraphCard';
import { AmiPeakBreakdownCard } from '../../components/AmiPeakBreakdownCard';
import { AnalogPhotographyGuideModal } from '../../components/AnalogPhotographyGuideModal';
import { AnalogMeterVerificationDrawer } from '../../components/AnalogMeterVerificationDrawer';
import { WeeklyAnalogCurveGraph } from '../../components/WeeklyAnalogCurveGraph';
import {
  captureMeterPhoto,
  extractAnalogMeterReading,
  saveAnalogMeterLog,
  getWeeklyAnalogSummary,
  kwhToDials,
} from '../../services/analogMeterService';
import { AnalogMeterLogEntry, AnalogMeterType, WeeklyAnalogSummary } from '../../types/analogMeter';
import { AmiTimeframe } from '../../types/amiTelemetry';
import { calculateTierCliff } from '../../lib/tariffEngine';
import { buildDashboardExplanationPrompt } from '../../lib/geminiService';
import { formatCANDisplay } from '../../utils/validation';
import { MOCK_USER } from '../../constants/mockData';

const APP_LOGO = require('../../../assets/app-logo.png');

export default function HomeScreen() {
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';
  const isFilipino = language === 'filipino';
  const greetingLead = isEnglish ? 'Good day,' : isFilipino ? 'Maligayang araw,' : 'Magandang araw,';
  const { user } = useAuth();
  const {
    budget,
    projected,
    currentKwh,
    activeBill,
    setActiveBill,
    activeCanProfile,
    askTipi,
  } = useEnergy();

  const cliff = calculateTierCliff(currentKwh);
  const userName = user?.fullName || activeCanProfile?.customerName || MOCK_USER.name;
  const canNumber =
    activeCanProfile?.accountNumber ||
    (user?.can ? formatCANDisplay(user.can) : null) ||
    activeBill?.customerAccountNumber ||
    MOCK_USER.accountNumber;
  const profileName = activeCanProfile?.name || 'Bahay';
  const ratePerKwh = activeCanProfile?.ratePerKwh || MOCK_USER.ratePerKwh;
  const meterType = activeCanProfile?.meterType || 'AMI';
  const isAmi = meterType === 'AMI';
  const meterSerial =
    activeCanProfile?.meterSerialNumber ||
    (isAmi ? 'MR-AMI-4410' : 'MR-ANA-3321');
  const lastReadingDate = activeCanProfile?.lastReadingDate || '2026-05-14';

  // AMI Synchronized Timeframe State (Day, Week, Month, Year)
  const [amiTimeframe, setAmiTimeframe] = useState<AmiTimeframe>('day');

  // Analog Modal & Drawer State
  const [guideModalVisible, setGuideModalVisible] = useState<boolean>(false);
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [detectionFailedVisible, setDetectionFailedVisible] = useState<boolean>(false);
  const [detectionFailureReason, setDetectionFailureReason] = useState<
    'not_a_meter' | 'blurry' | 'unreadable' | 'low_confidence' | undefined
  >(undefined);
  const [detectedCategory, setDetectedCategory] = useState<
    'electronic' | 'electromechanical' | undefined
  >(undefined);
  const [detectedDialCount, setDetectedDialCount] = useState<4 | 5 | undefined>(undefined);
  const [capturing, setCapturing] = useState<boolean>(false);
  const [analogSubtype, setAnalogSubtype] = useState<AnalogMeterType>('dial');
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | undefined>(undefined);
  const [pendingReadingKwh, setPendingReadingKwh] = useState<number>(14285);
  const [pendingDials, setPendingDials] = useState<number[]>([1, 4, 2, 8, 5]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklyAnalogSummary | undefined>(undefined);

  // Load analog weekly summary on CAN / profile change
  const loadAnalogSummary = useCallback(async () => {
    if (!isAmi && canNumber) {
      try {
        const s = await getWeeklyAnalogSummary(canNumber, budget, ratePerKwh);
        setWeeklySummary(s);
      } catch {
        // ignore error
      }
    }
  }, [isAmi, canNumber, budget, ratePerKwh]);

  useEffect(() => {
    loadAnalogSummary();
  }, [loadAnalogSummary]);

  // Analog Photo Capture Handler
  const handleCaptureAnalogPhoto = async (preferredSubtype?: AnalogMeterType) => {
    const activeSubtype = preferredSubtype || analogSubtype;
    if (preferredSubtype) {
      setAnalogSubtype(preferredSubtype);
    }
    try {
      setCapturing(true);
      const captureResult = await captureMeterPhoto();
      if (!captureResult.canceled && captureResult.uri) {
        setPendingPhotoUri(captureResult.uri);

        const previousReading =
          weeklySummary?.currentReadingKwh || activeCanProfile?.currentKwh || 14240;
        const extracted = await extractAnalogMeterReading(
          captureResult.base64 || '',
          previousReading,
          activeSubtype
        );

        // Automatically record detected category and dial count from photo analysis
        if (extracted.detectedMeterCategory && extracted.detectedMeterCategory !== 'unknown') {
          setDetectedCategory(extracted.detectedMeterCategory);
        }
        if (extracted.dialCount) {
          setDetectedDialCount(extracted.dialCount);
        }

        // If an electric meter was not detected or the photo is too blurry/low confidence
        if (
          extracted.isMeterDetected === false ||
          (typeof extracted.confidence === 'number' && extracted.confidence < 0.6)
        ) {
          setDetectionFailureReason(extracted.failureReason || 'not_a_meter');
          setDetectionFailedVisible(true);
          return;
        }

        setAnalogSubtype(extracted.meterType || activeSubtype);
        setPendingReadingKwh(extracted.readingKwh);
        setPendingDials(extracted.dials);
        setDrawerVisible(true);
      }
    } catch {
      Alert.alert(
        isEnglish ? 'Notice' : 'Paalala',
        isEnglish
          ? 'Failed to capture or process meter photo.'
          : 'Hindi matagumpay ang pagkuha ng litrato ng meter.'
      );
    } finally {
      setCapturing(false);
    }
  };

  // Manual encode trigger for analog meters -> Go to new multi-step manual input screen
  const handleManualAnalogInput = () => {
    const prev = weeklySummary?.currentReadingKwh || activeCanProfile?.currentKwh || 14240;
    router.push({
      pathname: '/manual-meter-input',
      params: {
        previousReading: String(prev),
        can: canNumber || '',
        autoDetectedType: detectedCategory || (analogSubtype === 'cyclometer' ? 'electronic' : 'electromechanical'),
        dialCount: detectedDialCount ? String(detectedDialCount) : undefined,
      },
    });
  };

  // Save confirmed reading from verification drawer
  const handleConfirmAnalogLog = async (entry: AnalogMeterLogEntry) => {
    try {
      await saveAnalogMeterLog(entry);
      setAnalogSubtype(entry.meterType);
      if (activeBill && entry.normalizedWeeklyKwh > 0) {
        const projectedMonthlyKwh = Math.round(entry.normalizedWeeklyKwh * 4.3);
        setActiveBill({
          ...activeBill,
          totalKwh: projectedMonthlyKwh,
          totalAmountDue: Math.round(projectedMonthlyKwh * ratePerKwh * 100) / 100,
        });
      }
      setDrawerVisible(false);
      await loadAnalogSummary();
      Alert.alert(
        isEnglish ? 'Success' : 'Tagumpay',
        isEnglish
          ? `Saved analog reading: ${entry.readingKwh.toLocaleString()} kWh (+${entry.normalizedWeeklyKwh} kWh/wk).`
          : `Nai-save ang analog reading: ${entry.readingKwh.toLocaleString()} kWh (+${entry.normalizedWeeklyKwh} kWh/linggo).`
      );
    } catch {
      Alert.alert(
        'Error',
        isEnglish ? 'Failed to save analog reading.' : 'Hindi nai-save ang analog reading.'
      );
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <PageTransitionView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Greeting */}
          <View style={styles.header}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.greetingTitle, { color: theme.ink, fontSize: 22 * fontScale, fontFamily: 'Coolvetica' }]}>
                {greetingLead} <Text style={{ color: '#FF6B00' }}>{userName}!</Text>
              </Text>
              <Text style={[styles.canSubtitle, { color: theme.muted, fontSize: 13 * fontScale, fontFamily: 'Coolvetica' }]}>
                CAN: {canNumber} · {profileName}
              </Text>
              {/* Meter Classification Badge */}
              <View style={styles.badgeWrapper}>
                <MeterClassificationBadge
                  meterType={meterType}
                  size="standard"
                  showIcon={false}
                  showSubtitle
                  onPress={() => {
                    if (!isAmi) {
                      setGuideModalVisible(true);
                    }
                  }}
                />
              </View>
            </View>
            <View style={styles.headerRightGroup}>
              <Image
                source={APP_LOGO}
                style={styles.headerLogo}
                resizeMode="contain"
                accessibilityLabel="Kuryentipid Logo"
              />
              <HeaderAlertButton from="index" />
              <HeaderSettingsButton />
            </View>
          </View>

          {/* Budget Circular Gauge Card */}
          <BudgetGauge projected={projected} budget={budget} />

          {/* Tipi Gemini AI Usage & Budget Analysis Card */}
          <UsageAnalysisCard />

          {/* Dynamic Workflow Routing Conditioned on meterType */}
          {isAmi ? (
            <View style={styles.workflowSection} testID="ami-dashboard-section">
              {/* Dynamic Multi-Timeframe AMI SVG Curve Graph */}
              <AmiCurveGraphCard
                can={canNumber}
                timeframe={amiTimeframe}
                initialTimeframe="day"
                onTimeframeChange={setAmiTimeframe}
              />

              {/* AMI Peak vs Off-Peak Analytics Card */}
              <AmiPeakBreakdownCard
                can={canNumber}
                timeframe={amiTimeframe}
                onShiftSavingsPress={() => router.push('/whatif')}
              />
            </View>
          ) : (
            <View style={styles.workflowSection} testID="analog-dashboard-section">
              {/* Analog Meter Action & Status Card */}
              <View
                style={[
                  styles.analogActionCard,
                  { backgroundColor: theme.surface, borderColor: theme.line },
                ]}
              >
                <View style={styles.analogHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.analogCardTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
                      Analog Meter Log
                    </Text>
                    <Text style={[styles.analogCardSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                      {lastReadingDate} · {meterSerial}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.guideTriggerBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                    onPress={() => setGuideModalVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={isEnglish ? 'Open analog meter reading guide' : 'Buksan ang gabay sa pagbasa ng analog meter'}
                  >
                    <Text style={[styles.guideTriggerText, { color: theme.brand, fontSize: 12 * fontScale }]}>
                      {isEnglish ? 'Guide' : 'Gabay'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Action Buttons Row */}
                <View style={styles.analogBtnRow}>
                  <TouchableOpacity
                    style={[styles.cameraCaptureBtn, { backgroundColor: theme.brand }]}
                    onPress={() => handleCaptureAnalogPhoto()}
                    disabled={capturing}
                    accessibilityRole="button"
                    accessibilityLabel={isEnglish ? 'Take a photo of the analog meter' : 'Kunan ng litrato ang analog meter'}
                  >
                    {capturing ? (
                      <ActivityIndicator color={theme.brandInk} size="small" />
                    ) : (
                      <Text
                        style={[
                          styles.cameraCaptureBtnText,
                          { color: theme.brandInk, fontSize: 13.5 * fontScale },
                        ]}
                      >
                        {isEnglish ? 'Take Photo' : 'Kunan ng Litrato'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.manualEncodeBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                    onPress={handleManualAnalogInput}
                    accessibilityRole="button"
                    accessibilityLabel={isEnglish ? 'Manually encode meter reading' : 'Manu-manong i-encode ang reading'}
                  >
                    <Text style={[styles.manualEncodeBtnText, { color: theme.ink, fontSize: 13 * fontScale }]}>
                      {isEnglish ? 'Encode' : 'I-encode'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Weekly Analog Curve Graph with Budget Ceiling Reference */}
              <WeeklyAnalogCurveGraph
                can={canNumber}
                monthlyBudget={budget}
                effectiveRate={ratePerKwh}
                summary={weeklySummary}
              />
            </View>
          )}

          {/* Live Grid Metrics Row (no emojis) */}
          <View style={styles.metricsRow}>
            <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: '#FF6B0035' }]}>
              <Text style={[styles.metricValue, { color: '#FF6B00', fontSize: 22 * fontScale, fontFamily: 'Coolvetica' }]}>
                {currentKwh} kWh
              </Text>
              <Text style={[styles.metricLabel, { color: theme.muted, fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'CONSUMPTION' : 'Konsumo'}
              </Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: '#FF6B0035' }]}>
              <Text style={[styles.metricValue, { color: '#FF6B00', fontSize: 22 * fontScale, fontFamily: 'Coolvetica' }]}>
                ₱{ratePerKwh}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.muted, fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'CURRENT RATE' : 'Rate / kWh'}
              </Text>
            </View>
          </View>

          {/* Primary CTA: What-If Watt-Calculator */}
          <TouchableOpacity
            style={[styles.primaryActionCard, { backgroundColor: theme.brand }]}
            onPress={() => router.push('/whatif')}
            accessibilityRole="button"
            accessibilityLabel={isEnglish ? 'Open What-If Watt Calculator' : 'Buksan ang What-If Watt Calculator'}
          >
            <View style={styles.actionCardContent}>
              <Text style={[styles.actionCardTitle, { color: theme.brandInk, fontSize: 17 * fontScale, fontFamily: 'Coolvetica' }]}>
                What-If Watt-Calculator
              </Text>
              <Text style={[styles.actionCardSub, { color: theme.brandInk, fontSize: 12.5 * fontScale }]}>
                {isEnglish ? 'Calculate potential appliance savings.' : 'Kalkulahin ang tipid sa appliances.'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Quick Action: Scan Meralco Bill */}
          <TouchableOpacity
            style={[styles.secondaryActionCard, { backgroundColor: theme.surface, borderColor: '#FF6B0040' }]}
            onPress={() => router.push('/(tabs)/bill')}
            accessibilityRole="button"
            accessibilityLabel={isEnglish ? 'Scan Meralco Bill' : 'I-scan ang Meralco Bill'}
          >
            <Text style={[styles.secondaryTitle, { color: theme.ink, fontSize: 16 * fontScale, fontFamily: 'Coolvetica' }]}>
              {isEnglish ? 'Scan Meralco Bill' : 'I-scan ang Meralco Bill'}
            </Text>
            <Text style={[styles.secondarySub, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
              {isEnglish
                ? 'Take a photo or upload your electric bill copy.'
                : 'I-upload ang litrato ng iyong bill.'}
            </Text>
          </TouchableOpacity>

          {/* Quick Action: Explain Dashboard with Tipi */}
          <TouchableOpacity
            style={[styles.secondaryActionCard, { backgroundColor: theme.cont, borderColor: '#FF6B0035' }]}
            onPress={() =>
              askTipi(
                buildDashboardExplanationPrompt({
                  profileName,
                  can: canNumber,
                  meterType,
                  currentKwh,
                  projected,
                  budget,
                  ratePerKwh,
                  language,
                })
              )
            }
            accessibilityRole="button"
            accessibilityLabel={isEnglish ? 'Explain Consumption with Tipi' : 'Ipaliwanag kay Tipi ang Konsumo at Dashboard'}
          >
            <Text style={[styles.secondaryTitle, { color: theme.ink, fontSize: 16 * fontScale, fontFamily: 'Coolvetica' }]}>
              {isEnglish ? 'Explain Consumption with Tipi' : 'Ipaliwanag kay Tipi ang Konsumo'}
            </Text>
            <Text style={[styles.secondarySub, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
              {isEnglish
                ? 'Get an AI breakdown of your consumption and budget.'
                : 'Humingi ng AI paliwanag sa iyong konsumo at budget.'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </PageTransitionView>

      {/* Analog Photography Guidance Modal */}
      <AnalogPhotographyGuideModal
        visible={guideModalVisible}
        onClose={() => setGuideModalVisible(false)}
        initialMeterType={analogSubtype}
        onProceedToCamera={(selectedType) => handleCaptureAnalogPhoto(selectedType)}
      />

      {/* Analog Meter Manual Verification Drawer */}
      <AnalogMeterVerificationDrawer
        visible={drawerVisible}
        can={canNumber}
        initialReadingKwh={pendingReadingKwh}
        initialDials={pendingDials}
        initialMeterType={analogSubtype}
        previousReadingKwh={weeklySummary?.currentReadingKwh || activeCanProfile?.currentKwh || 14240}
        photoUri={pendingPhotoUri}
        effectiveRate={ratePerKwh}
        onConfirm={handleConfirmAnalogLog}
        onRetake={() => handleCaptureAnalogPhoto()}
        onCancel={() => setDrawerVisible(false)}
        onOpenGuide={() => setGuideModalVisible(true)}
      />

      {/* Detection Failed Modal */}
      <Modal
        visible={detectionFailedVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetectionFailedVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.failModalCard, { backgroundColor: theme.surface, borderColor: '#FF6B0040' }]}>
            {/* Camera with X badge (increased by 50% for high visibility: 64 -> 96) */}
            <View style={styles.failIconContainer}>
              <Svg width={96} height={96} viewBox="0 0 64 64">
                <Circle cx="32" cy="32" r="30" fill="#FF3B1D15" stroke="#FF3B1D30" strokeWidth="2" />
                {/* Camera body */}
                <Rect x="16" y="22" width="32" height="24" rx="4" fill="none" stroke="#FF3B1D" strokeWidth="2.5" />
                <Path d="M24 22 L26 17 L38 17 L40 22 Z" fill="none" stroke="#FF3B1D" strokeWidth="2" />
                <Circle cx="32" cy="34" r="7" fill="none" stroke="#FF3B1D" strokeWidth="2.2" />
                {/* Red cross on corner */}
                <Circle cx="46" cy="20" r="7" fill="#FF3B1D" />
                <Line x1="43" y1="17" x2="49" y2="23" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                <Line x1="49" y1="17" x2="43" y2="23" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </View>

            <Text style={[styles.failTitle, { color: theme.ink, fontSize: 19 * fontScale, fontFamily: 'Coolvetica' }]}>
              {detectionFailureReason === 'blurry'
                ? isEnglish
                  ? 'Photo Too Blurry'
                  : 'Masyadong Malabo ang Litrato'
                : isEnglish
                  ? 'No Meter Detected'
                  : 'Hindi Na-detect ang Meter'}
            </Text>
            <Text style={[styles.failSubtitle, { color: theme.muted, fontSize: 13 * fontScale }]}>
              {detectionFailureReason === 'blurry'
                ? isEnglish
                  ? 'The photo is too blurry or glary to read the meter dials clearly. Please hold steady with good lighting, or input the numbers manually.'
                  : 'Masyadong malabo o masilaw ang litrato para basahin ang mga dial ng metro. Pakitapat nang maayos o manu-manong ilagay ang numero.'
                : isEnglish
                  ? "The camera couldn't detect an electric meter (electronic or electromechanical) in this photo. Make sure to take a clear, direct shot of your meter."
                  : 'Hindi nakakita ng metro ng kuryente (elektroniko man o electromechanical) sa litratong ito. Siguraduhing nakatutok ang camera sa iyong metro.'}
            </Text>

            {/* 3 Action Buttons */}
            <View style={styles.failActionsCol}>
              {/* 1. Retake */}
              <TouchableOpacity
                style={[styles.retakeActionBtn, { backgroundColor: '#FF6B00' }]}
                onPress={() => {
                  setDetectionFailedVisible(false);
                  setTimeout(() => {
                    handleCaptureAnalogPhoto();
                  }, 250);
                }}
                accessibilityRole="button"
                accessibilityLabel="Retake photo"
              >
                <Text style={[styles.retakeActionText, { color: '#FFFFFF', fontSize: 14.5 * fontScale }]}>
                  {isEnglish ? 'Retake Photo' : 'Kumuha Muli ng Litrato'}
                </Text>
              </TouchableOpacity>

              {/* 2. Enter Manually */}
              <TouchableOpacity
                style={[styles.manualActionBtn, { borderColor: '#FF6B00', backgroundColor: theme.cont }]}
                onPress={() => {
                  setDetectionFailedVisible(false);
                  const prev = weeklySummary?.currentReadingKwh || activeCanProfile?.currentKwh || 14240;
                  router.push({
                    pathname: '/manual-meter-input',
                    params: {
                      previousReading: String(prev),
                      can: canNumber || '',
                      autoDetectedType: detectedCategory || (analogSubtype === 'cyclometer' ? 'electronic' : 'electromechanical'),
                      dialCount: detectedDialCount ? String(detectedDialCount) : undefined,
                    },
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel="Enter manually"
              >
                <Text style={[styles.manualActionText, { color: '#FF6B00', fontSize: 14 * fontScale }]}>
                  {isEnglish ? 'Input Data Manually' : 'Manu-manong Ilagay ang Data'}
                </Text>
              </TouchableOpacity>

              {/* 3. Cancel */}
              <TouchableOpacity
                style={styles.cancelActionBtn}
                onPress={() => setDetectionFailedVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.cancelActionText, { color: theme.muted, fontSize: 13.5 * fontScale }]}>
                  {isEnglish ? 'Cancel' : 'Kanselahin'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  greetingTitle: {
    fontWeight: '800',
  },
  canSubtitle: {
    fontWeight: '600',
    marginTop: 2,
  },
  badgeWrapper: {
    marginTop: 6,
  },
  workflowSection: {
    marginVertical: 4,
  },
  analogActionCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 6,
  },
  analogHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  analogCardTitle: {
    fontWeight: '800',
  },
  analogCardSub: {
    fontWeight: '500',
    marginTop: 2,
  },
  guideTriggerBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginLeft: 8,
  },
  guideTriggerText: {
    fontWeight: '700',
  },
  analogBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cameraCaptureBtn: {
    flex: 2,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCaptureBtnText: {
    fontWeight: '800',
  },
  manualEncodeBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualEncodeBtnText: {
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    fontWeight: '600',
  },
  primaryActionCard: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  actionCardContent: {
    gap: 2,
  },
  actionCardTitle: {
    fontWeight: '800',
  },
  actionCardSub: {
    opacity: 0.95,
    lineHeight: 18,
  },
  secondaryActionCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 6,
  },
  secondaryTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  secondarySub: {
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  failModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  failIconContainer: {
    marginBottom: 14,
  },
  failTitle: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  failSubtitle: {
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  failActionsCol: {
    width: '100%',
    gap: 10,
  },
  retakeActionBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  retakeActionText: {
    fontWeight: '800',
  },
  manualActionBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  manualActionText: {
    fontWeight: '800',
  },
  cancelActionBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  cancelActionText: {
    fontWeight: '600',
  },
});
