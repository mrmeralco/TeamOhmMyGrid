import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Dimensions,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, {
  Circle,
  Rect,
  Path,
  Line,
  G,
  Text as SvgText,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { PageTransitionView } from '../components/PageTransitionView';
import {
  saveAnalogMeterLog,
  calculateWeeklyAnalogDelta,
  kwhToDials,
  dialsToKwh,
} from '../services/analogMeterService';
import { AnalogMeterLogEntry, AnalogMeterType } from '../types/analogMeter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
// SVGs & Visual Aids
// ─────────────────────────────────────────────────────────────

// Electronic Meter Icon / Illustration
const ElectronicMeterGraphic = ({
  size = 140,
  showArrow = false,
  readingText = '03456',
}: {
  size?: number;
  showArrow?: boolean;
  readingText?: string;
}) => {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 160 160">
        {/* Outer Circular Casing */}
        <Circle cx="80" cy="80" r="72" fill="#E6EDE7" stroke="#A8BCA9" strokeWidth="6" />
        <Circle cx="80" cy="80" r="66" fill="#F4F8F4" stroke="#D1DDD2" strokeWidth="2" />

        {/* Top Camera / Sensor Notch */}
        <Rect x="73" y="22" width="14" height="6" rx="2" fill="#C5D3C6" />
        <Circle cx="80" cy="34" r="3.5" fill="#5F7561" />

        {/* LCD Display Window */}
        <Rect
          x="32"
          y="48"
          width="96"
          height="40"
          rx="6"
          fill="#3B4A3C"
          stroke="#273228"
          strokeWidth="2.5"
        />
        {/* LCD Inner Backlight */}
        <Rect x="36" y="52" width="88" height="32" rx="4" fill="#9FB9A1" />

        {/* Digital Digits */}
        <SvgText
          x="44"
          y="75"
          fill="#1C271E"
          fontSize="20"
          fontWeight="900"
          fontFamily={Platform.OS === 'ios' ? 'Courier' : 'monospace'}
          letterSpacing={2}
        >
          {readingText}
        </SvgText>

        {/* kWh unit */}
        <SvgText
          x="100"
          y="74"
          fill="#2C3B2E"
          fontSize="9"
          fontWeight="bold"
        >
          kWh
        </SvgText>

        {/* Optical Port Button */}
        <Circle cx="112" cy="102" r="6" fill="#889889" stroke="#6C7E6D" strokeWidth="1.5" />
        <Circle cx="112" cy="102" r="3" fill="#4B5A4C" />

        {/* Barcode & Specs Plaque */}
        <Rect x="44" y="106" width="72" height="30" rx="3" fill="#FFFFFF" stroke="#CCD5CD" strokeWidth="1" />

        {/* Meralco "M" stylized emblem */}
        <Circle cx="55" cy="121" r="7" fill="#FF5500" />
        <Path
          d="M 51 125 L 53 117 L 55 121 L 57 117 L 59 125"
          stroke="#FFFFFF"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Barcode Lines */}
        <G transform="translate(68, 114)">
          <Line x1="0" y1="0" x2="0" y2="10" stroke="#1A1A1A" strokeWidth="1.5" />
          <Line x1="4" y1="0" x2="4" y2="10" stroke="#1A1A1A" strokeWidth="1" />
          <Line x1="7" y1="0" x2="7" y2="10" stroke="#1A1A1A" strokeWidth="2.5" />
          <Line x1="12" y1="0" x2="12" y2="10" stroke="#1A1A1A" strokeWidth="1" />
          <Line x1="16" y1="0" x2="16" y2="10" stroke="#1A1A1A" strokeWidth="2" />
          <Line x1="20" y1="0" x2="20" y2="10" stroke="#1A1A1A" strokeWidth="1.5" />
          <Line x1="24" y1="0" x2="24" y2="10" stroke="#1A1A1A" strokeWidth="1" />
          <Line x1="28" y1="0" x2="28" y2="10" stroke="#1A1A1A" strokeWidth="2" />
          <Line x1="33" y1="0" x2="33" y2="10" stroke="#1A1A1A" strokeWidth="1.5" />
          <Line x1="38" y1="0" x2="38" y2="10" stroke="#1A1A1A" strokeWidth="1" />
          <Line x1="42" y1="0" x2="42" y2="10" stroke="#1A1A1A" strokeWidth="2" />
        </G>
        <SvgText x="68" y="131" fill="#4A4A4A" fontSize="5" fontWeight="600">
          23 298 809
        </SvgText>

        {/* Indicator Arrow if requested */}
        {showArrow && (
          <G transform="translate(132, 68)">
            <Path
              d="M 16 0 L 0 0 M 6 -5 L 0 0 L 6 5"
              stroke="#FF3B1D"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        )}
      </Svg>
    </View>
  );
};

// Electromechanical Meter Icon / Illustration (4/5 dials with rotation indicators)
// Increased by 50% (base viewBox 160 -> larger display size default 210)
const ElectromechanicalMeterGraphic = ({
  size = 210,
}: {
  size?: number;
}) => {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 160 160">
        {/* Outer Circular Casing */}
        <Circle cx="80" cy="80" r="72" fill="#DCE7DD" stroke="#9EABA0" strokeWidth="6" />
        <Circle cx="80" cy="80" r="66" fill="#EEF4EF" stroke="#CAD5CB" strokeWidth="2" />

        {/* Top Nameplate */}
        <Circle cx="80" cy="38" r="8" fill="#1B1B1B" />
        <Path
          d="M 75 42 L 77 34 L 80 38 L 83 34 L 85 42"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Line x1="40" y1="38" x2="66" y2="38" stroke="#333333" strokeWidth="2" />
        <Line x1="94" y1="38" x2="120" y2="38" stroke="#333333" strokeWidth="2" />

        {/* Disc Cutout / Rotor Window on Left */}
        <Circle cx="40" cy="68" r="10" fill="#2E3830" />

        {/* 4 Clock Dials */}
        {/* Dial 1 (CCW) */}
        <G transform="translate(62, 68)">
          <Circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#5D6D60" strokeWidth="1.2" />
          <Line x1="0" y1="0" x2="-5" y2="-4" stroke="#D32F2F" strokeWidth="1.6" strokeLinecap="round" />
          <Circle cx="0" cy="0" r="1.5" fill="#1C1C1C" />
        </G>
        {/* Dial 2 (CW) */}
        <G transform="translate(84, 68)">
          <Circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#5D6D60" strokeWidth="1.2" />
          <Line x1="0" y1="0" x2="5" y2="-4" stroke="#D32F2F" strokeWidth="1.6" strokeLinecap="round" />
          <Circle cx="0" cy="0" r="1.5" fill="#1C1C1C" />
        </G>
        {/* Dial 3 (CCW) */}
        <G transform="translate(106, 68)">
          <Circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#5D6D60" strokeWidth="1.2" />
          <Line x1="0" y1="0" x2="-4" y2="4" stroke="#D32F2F" strokeWidth="1.6" strokeLinecap="round" />
          <Circle cx="0" cy="0" r="1.5" fill="#1C1C1C" />
        </G>
        {/* Dial 4 (CW) */}
        <G transform="translate(128, 68)">
          <Circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#5D6D60" strokeWidth="1.2" />
          <Line x1="0" y1="0" x2="4" y2="4" stroke="#D32F2F" strokeWidth="1.6" strokeLinecap="round" />
          <Circle cx="0" cy="0" r="1.5" fill="#1C1C1C" />
        </G>

        {/* KILOWATTHOURS Text */}
        <SvgText x="80" y="92" fill="#2E3B30" fontSize="7" fontWeight="bold" textAnchor="middle">
          KILOWATTHOURS
        </SvgText>

        {/* Bottom Specs Plaque */}
        <Rect x="44" y="104" width="72" height="32" rx="3" fill="#DDE7DF" stroke="#B8C5BA" strokeWidth="1" />
        <SvgText x="80" y="117" fill="#1E2820" fontSize="7.5" fontWeight="bold" textAnchor="middle">
          33CZN23688
        </SvgText>
        <SvgText x="80" y="128" fill="#1E2820" fontSize="7.5" fontWeight="bold" textAnchor="middle">
          89 023 688
        </SvgText>
      </Svg>
    </View>
  );
};

// Single Dial Pointer Graphic showing "Smaller Number Rule"
// Increased by 50% for maximum clarity (width 270, height 195)
const DialExplanationGraphic = ({
  pointerBetween = [4, 5],
  chosenNumber = 4,
}: {
  pointerBetween?: [number, number];
  chosenNumber?: number;
}) => {
  return (
    <View style={{ alignItems: 'center', marginVertical: 12 }}>
      <Svg width={270} height={195} viewBox="0 0 180 130">
        <Circle cx="90" cy="65" r="50" fill="#F4F8F4" stroke="#4C6350" strokeWidth="3" />

        {/* 10 Dial Marks and Numbers (0 to 9 clockwise) */}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
          const angle = (num * 36 - 90) * (Math.PI / 180);
          const x = 90 + 38 * Math.cos(angle);
          const y = 65 + 38 * Math.sin(angle) + 4;
          const isChosen = num === chosenNumber;
          return (
            <SvgText
              key={num}
              x={x}
              y={y}
              fill={isChosen ? '#FF3B1D' : '#334436'}
              fontSize={isChosen ? '14' : '10'}
              fontWeight={isChosen ? '900' : '600'}
              textAnchor="middle"
            >
              {num}
            </SvgText>
          );
        })}

        {/* Pointer pointing between 4 and 5 */}
        <G transform="translate(90, 65)">
          {/* Pointer angle for between 4 and 5: ~72 degrees */}
          <Line
            x1="0"
            y1="0"
            x2="24"
            y2="20"
            stroke="#111812"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle cx="0" cy="0" r="4" fill="#111812" />
        </G>

        {/* Callout Arrow pointing to the smaller number (4) */}
        <G transform="translate(138, 94)">
          <Path
            d="M 24 10 L 0 0 M 8 -5 L 0 0 L 6 6"
            stroke="#FF3B1D"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <SvgText x="28" y="14" fill="#FF3B1D" fontSize="10" fontWeight="bold">
            Record {chosenNumber}!
          </SvgText>
        </G>
      </Svg>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function ManualMeterInputScreen() {
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';
  const params = useLocalSearchParams<{
    previousReading?: string;
    can?: string;
    autoDetectedType?: 'electronic' | 'electromechanical';
    dialCount?: string;
  }>();

  const previousReadingKwh = parseInt(params.previousReading || '14240', 10);
  const canNumber = params.can || '0123456789';

  // Automatically determine meter type from photo or param (default to 'electronic' if autoDetected, else 'electromechanical')
  const initialMeterType: 'electronic' | 'electromechanical' =
    params.autoDetectedType === 'electromechanical'
      ? 'electromechanical'
      : 'electronic';

  // Screen Stages: 'select' (Step 0 - now showing detected type) | 'electronic' | 'electromechanical'
  const [stage, setStage] = useState<'select' | 'electronic' | 'electromechanical'>('select');
  const [currentMeterType, setCurrentMeterType] = useState<'electronic' | 'electromechanical'>(initialMeterType);

  // Animation values for card selection in Step 0
  const electronicScale = useRef(new Animated.Value(1)).current;
  const electroScale = useRef(new Animated.Value(1)).current;
  const cardFlashAnim = useRef(new Animated.Value(0)).current;

  // Electronic input state: 5 digits (array of 5 numbers for stepper control)
  const [electronicDials, setElectronicDials] = useState<number[]>([0, 3, 4, 5, 6]);
  const [electronicInput, setElectronicInput] = useState<string>('03456');

  // Helper to step electronic digits via Up/Down buttons
  const handleStepElectronicDigit = (index: number, delta: 1 | -1) => {
    try {
      Haptics.selectionAsync();
    } catch { }
    const updated = [...electronicDials];
    updated[index] = (updated[index] + delta + 10) % 10;
    setElectronicDials(updated);
    setElectronicInput(updated.join(''));
  };

  // Helper when user types manually into the keyboard input
  const handleTypeElectronicInput = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '').slice(0, 5);
    setElectronicInput(clean);
    const padded = clean.padEnd(5, '0');
    setElectronicDials(padded.split('').map((c) => parseInt(c, 10) || 0));
  };

  // Electromechanical input state: 4 or 5 dials
  const initialDialCount: 4 | 5 = params.dialCount === '5' ? 5 : 4;
  const [dialCount, setDialCount] = useState<4 | 5>(initialDialCount);
  const [electromechanicalDials, setElectromechanicalDials] = useState<number[]>([0, 4, 9, 8, 7]);

  const DIAL_POSITIONS = ['10,000s', '1,000s', '100s', '10s', '1s'];

  // Handle proceed from auto-detected card
  const handleProceedWithDetectedType = (type: 'electronic' | 'electromechanical') => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { }

    const targetScale = type === 'electronic' ? electronicScale : electroScale;

    Animated.sequence([
      Animated.timing(targetScale, {
        toValue: 0.94,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.spring(targetScale, {
        toValue: 1.05,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.spring(targetScale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      setStage(type);
    }, 280);
  };

  // Dial step helper for electromechanical
  const handleStepDial = (index: number, delta: 1 | -1) => {
    // If 4 dials are selected and user tries to change the first dial (10,000s), lock it to 0
    if (dialCount === 4 && index === 0) {
      return;
    }
    try {
      Haptics.selectionAsync();
    } catch { }
    const updated = [...electromechanicalDials];
    updated[index] = (updated[index] + delta + 10) % 10;
    setElectromechanicalDials(updated);
  };

  // Save to database
  const handleConfirm = async (readingKwh: number, meterType: AnalogMeterType) => {
    if (isNaN(readingKwh) || readingKwh < 0) {
      Alert.alert(
        isEnglish ? 'Invalid Reading' : 'Maling Reading',
        isEnglish ? 'Please enter a valid positive number.' : 'Maglagay ng wastong numero.'
      );
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { }

    const deltaResult = calculateWeeklyAnalogDelta(readingKwh, previousReadingKwh, 7, 11.43);

    const entry: AnalogMeterLogEntry = {
      id: `analog-manual-${Date.now()}`,
      can: canNumber,
      timestamp: new Date().toISOString(),
      readingKwh,
      weeklyUsageKwh: deltaResult.weeklyUsageKwh,
      daysSinceLastReading: 7,
      normalizedWeeklyKwh: deltaResult.normalizedWeeklyKwh,
      costEstimate: deltaResult.costEstimate,
      verifiedByUser: true,
      meterType,
      dials: meterType === 'dial' ? electromechanicalDials : kwhToDials(readingKwh),
      notes: 'Manual input via guide',
    };

    try {
      await saveAnalogMeterLog(entry);
      Alert.alert(
        isEnglish ? 'Reading Saved' : 'Nai-save ang Reading',
        isEnglish
          ? `Successfully recorded ${readingKwh.toLocaleString()} kWh.`
          : `Matagumpay na naitala ang ${readingKwh.toLocaleString()} kWh.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch {
      Alert.alert('Error', isEnglish ? 'Failed to save meter log.' : 'Hindi nai-save ang reading.');
    }
  };

  // ─────────────────────────────────────────────────────────
  // STEP 0: Auto-Detected Meter Display Screen (No Manual Guessing Required)
  // ─────────────────────────────────────────────────────────
  if (stage === 'select') {
    const isDetectedElectronic = currentMeterType === 'electronic';

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
        <PageTransitionView style={{ flex: 1 }}>
          {/* Header with Exit Button */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.exitBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
              accessibilityRole="button"
              accessibilityLabel="Exit manual input"
            >
              <Text style={[styles.exitBtnText, { color: theme.ink }]}>✕</Text>
            </TouchableOpacity>
            <Text style={[styles.topBarTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
              {isEnglish ? 'Meter Type Verified' : 'Natukoy na Uri ng Metro'}
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={styles.selectionScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.instructionHeader}>
              <View style={[styles.detectedBadgePill, { backgroundColor: '#FF6B0018', borderColor: '#FF6B00' }]}>
                <Text style={[styles.detectedBadgePillText, { color: '#FF6B00' }]}>
                  {isEnglish ? 'AUTO-DETECTED FROM PHOTO' : 'KUSANG NATUKOY SA LITRATO'}
                </Text>
              </View>
              <Text style={[styles.mainHeading, { color: theme.ink, fontSize: 24 * fontScale, fontFamily: 'Coolvetica', marginTop: 8 }]}>
                {isDetectedElectronic
                  ? isEnglish ? 'Electronic Meter' : 'Elektronikong Metro'
                  : isEnglish ? 'Electromechanical Meter' : 'Electromechanical na Metro'}
              </Text>
              <Text style={[styles.subHeading, { color: theme.muted, fontSize: 13.5 * fontScale }]}>
                {isDetectedElectronic
                  ? isEnglish
                    ? 'Our system identified your meter as Electronic with a digital LCD display.'
                    : 'Natukoy ng aming sistema ang iyong metro bilang Electronic na may digital LCD screen.'
                  : isEnglish
                    ? `Our system identified your meter as Electromechanical with ${dialCount} clock dials.`
                    : `Natukoy ng aming sistema ang iyong metro bilang Electromechanical na may ${dialCount} na paikot na dial.`}
              </Text>
            </View>

            {/* Prominent Auto-Detected Meter Card Display */}
            <Animated.View style={{ transform: [{ scale: isDetectedElectronic ? electronicScale : electroScale }] }}>
              <View
                style={[
                  styles.autoDetectedCard,
                  {
                    backgroundColor: theme.surface,
                    borderColor: '#FF6B00',
                  },
                ]}
              >
                <View style={styles.detectedGraphicHeader}>
                  {isDetectedElectronic ? (
                    <ElectronicMeterGraphic size={170} />
                  ) : (
                    <ElectromechanicalMeterGraphic size={170} />
                  )}
                </View>

                <View style={[styles.detectedSpecBox, { backgroundColor: theme.cont }]}>
                  <Text style={[styles.detectedSpecTitle, { color: '#FF6B00', fontSize: 13 * fontScale }]}>
                    {isDetectedElectronic
                      ? isEnglish ? 'Digital 5-Digit Display' : 'Digital na 5-Digit Display'
                      : isEnglish ? `${dialCount}-Dial Clock Pointers` : `${dialCount}-Dial na mga Karayom`}
                  </Text>
                  <Text style={[styles.detectedSpecSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                    {isDetectedElectronic
                      ? isEnglish
                        ? 'Read numbers directly from the LCD screen.'
                        : 'Direktang basahin ang numero sa LCD screen.'
                      : isEnglish
                        ? 'Follow the smaller number rule for each dial needle.'
                        : 'Sundin ang mas maliit na numero sa bawat dial.'}
                  </Text>
                </View>

                {/* Primary CTA: Proceed directly into input */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => handleProceedWithDetectedType(currentMeterType)}
                  style={[styles.proceedCTA, { backgroundColor: '#FF6B00' }]}
                  accessibilityRole="button"
                  accessibilityLabel="Proceed to input"
                >
                  <Text style={[styles.proceedCTAText, { color: '#FFFFFF', fontSize: 15.5 * fontScale }]}>
                    {isEnglish ? 'Proceed to Input Data' : 'Magpatuloy sa Pag-encode'} →
                  </Text>
                </TouchableOpacity>

                {/* Switcher Option in case user wants to toggle */}
                <TouchableOpacity
                  onPress={() => {
                    const toggled = isDetectedElectronic ? 'electromechanical' : 'electronic';
                    setCurrentMeterType(toggled);
                  }}
                  style={styles.switchTypeButton}
                  accessibilityRole="button"
                  accessibilityLabel="Switch meter type"
                >
                  <Text style={[styles.switchTypeText, { color: theme.muted, fontSize: 12 * fontScale }]}>
                    {isEnglish
                      ? `Not correct? Switch to ${isDetectedElectronic ? 'Electromechanical' : 'Electronic'}`
                      : `Hindi tama? Lumipat sa ${isDetectedElectronic ? 'Electromechanical' : 'Electronic'}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Helpful Explanation Tip */}
            <View style={[styles.tipCard, { backgroundColor: theme.cont, borderColor: theme.line, marginTop: 16 }]}>
              <Text style={[styles.tipTitle, { color: '#FF6B00', fontSize: 13 * fontScale }]}>
                {isEnglish ? 'Automatic Recognition' : 'Kusang Pagkilala'}
              </Text>
              <Text style={[styles.tipBody, { color: theme.muted, fontSize: 12 * fontScale }]}>
                {isEnglish
                  ? 'Your meter type was automatically analyzed from the captured image. You do not need to guess your meter model.'
                  : 'Kusang sinuri ang uri ng iyong metro mula sa litrato. Hindi mo na kailangang hulaan ang modelo ng iyong metro.'}
              </Text>
            </View>
          </ScrollView>
        </PageTransitionView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // STEP 1A: Electronic Meter Input Screen
  // ─────────────────────────────────────────────────────────
  if (stage === 'electronic') {
    const currentNum = parseInt(electronicInput, 10) || 0;
    const diff = currentNum - previousReadingKwh;

    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <PageTransitionView style={{ flex: 1 }}>
            {/* Top Bar */}
            <View style={styles.topBar}>
              <TouchableOpacity
                onPress={() => setStage('select')}
                style={[styles.exitBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Text style={[styles.exitBtnText, { color: theme.ink }]}>←</Text>
              </TouchableOpacity>
              <Text style={[styles.topBarTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
                {isEnglish ? 'Electronic Meter' : 'Elektronikong Metro'}
              </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.exitBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={[styles.exitBtnText, { color: theme.ink }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
              {/* Graphic with Arrow Indicator */}
              <View style={[styles.diagramCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <ElectronicMeterGraphic size={150} showArrow={true} readingText={electronicInput || '00000'} />
                <View style={styles.diagramBadge}>
                  <Text style={[styles.diagramBadgeText, { color: '#FF3B1D' }]}>
                    {isEnglish ? 'Arrow points to current reading display' : 'Itinuturo ng palaso ang digital display'}
                  </Text>
                </View>
              </View>

              {/* Step Instruction */}
              <View style={styles.guideStepBox}>
                <Text style={[styles.stepNumberBadge, { backgroundColor: '#FF6B00', color: '#FFF' }]}>
                  1
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.guideStepTitle, { color: theme.ink, fontSize: 15 * fontScale, fontFamily: 'Coolvetica' }]}>
                    {isEnglish ? 'Read the Digital Display' : 'Basahin ang Digital Display'}
                  </Text>
                  <Text style={[styles.guideStepDesc, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
                    {isEnglish
                      ? 'Simply read the number on the digital display to get your Current Reading.'
                      : 'Basahin lamang ang numerong lumalabas sa digital display para sa iyong Kasalukuyang Reading.'}
                  </Text>
                </View>
              </View>

              {/* 5-Digit Styled Input Steppers (Matching Electromechanical for Uniformity) */}
              <View style={[styles.interactiveDialCard, { backgroundColor: theme.surface, borderColor: '#FF6B00' }]}>
                <View style={styles.guideStepBox}>
                  <Text style={[styles.stepNumberBadge, { backgroundColor: '#FF6B00', color: '#FFF' }]}>
                    2
                  </Text>
                  <Text style={[styles.guideStepTitle, { color: theme.ink, fontSize: 15 * fontScale, fontFamily: 'Coolvetica' }]}>
                    {isEnglish ? 'Set the 5-Digit Reading' : 'Itakda ang 5-Digit na Reading'}
                  </Text>
                </View>
                <Text style={[styles.sectionHint, { color: theme.muted, fontSize: 12 * fontScale, marginBottom: 12 }]}>
                  {isEnglish
                    ? 'Use the up/down arrows or type below to adjust each digit.'
                    : 'Pindutin ang ▲ at ▼ o mag-type sa ibaba para itugma ang bawat digit.'}
                </Text>

                {/* Steppers Row for Electronic Digits */}
                <View style={styles.steppersRow}>
                  {electronicDials.map((digit, idx) => (
                    <View key={idx} style={styles.stepperCol}>
                      {/* Up button */}
                      <TouchableOpacity
                        onPress={() => handleStepElectronicDigit(idx, 1)}
                        style={[styles.stepBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Increase digit ${idx + 1}`}
                      >
                        <Text style={[styles.stepBtnText, { color: '#FF6B00' }]}>▲</Text>
                      </TouchableOpacity>

                      {/* Digit Box */}
                      <View style={[styles.stepperBox, { backgroundColor: theme.bg, borderColor: '#FF6B00' }]}>
                        <Text style={[styles.stepperValueText, { color: '#FF6B00', fontSize: 24 * fontScale }]}>
                          {digit}
                        </Text>
                      </View>

                      {/* Down button */}
                      <TouchableOpacity
                        onPress={() => handleStepElectronicDigit(idx, -1)}
                        style={[styles.stepBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Decrease digit ${idx + 1}`}
                      >
                        <Text style={[styles.stepBtnText, { color: '#FF6B00' }]}>▼</Text>
                      </TouchableOpacity>

                      <Text style={[styles.stepperColLabel, { color: theme.muted, fontSize: 9.5 * fontScale }]}>
                        {DIAL_POSITIONS[idx]}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Direct Numeric Input Option for Convenience */}
                <View style={{ marginTop: 16 }}>
                  <Text style={[styles.inputLabel, { color: theme.muted, fontSize: 11.5 * fontScale, marginBottom: 6 }]}>
                    {isEnglish ? 'Or quick-type full 5 digits:' : 'O mabilisang i-type ang 5 digits:'}
                  </Text>
                  <TextInput
                    style={[
                      styles.hiddenRealInput,
                      {
                        borderColor: theme.line,
                        color: theme.ink,
                        backgroundColor: theme.bg,
                      },
                    ]}
                    value={electronicInput}
                    onChangeText={handleTypeElectronicInput}
                    keyboardType="numeric"
                    maxLength={5}
                    placeholder="03456"
                    placeholderTextColor={theme.muted}
                    accessibilityLabel="5-digit meter reading input"
                  />
                </View>
              </View>

              {/* Delta & Calculation Preview */}
              <View style={[styles.calcPreviewCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
                    {isEnglish ? 'Current Reading' : 'Kasalukuyang Reading'}
                  </Text>
                  <Text style={[styles.calcVal, { color: theme.ink, fontSize: 14 * fontScale }]}>
                    {currentNum.toLocaleString()} kWh
                  </Text>
                </View>
                <View style={styles.calcRow}>
                  <Text style={[styles.calcLabel, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
                    {isEnglish ? 'Less Previous Reading' : 'Nakaraang Reading'}
                  </Text>
                  <Text style={[styles.calcVal, { color: theme.muted, fontSize: 14 * fontScale }]}>
                    {previousReadingKwh.toLocaleString()} kWh
                  </Text>
                </View>
                <View style={[styles.calcRow, styles.calcRowTotal, { borderTopColor: theme.line }]}>
                  <Text style={[styles.calcLabelBold, { color: theme.ink, fontSize: 13.5 * fontScale }]}>
                    {isEnglish ? 'Total kWh Used' : 'Kabuuang Gamit'}
                  </Text>
                  <Text
                    style={[
                      styles.calcValBold,
                      {
                        color: diff >= 0 ? '#FF6B00' : theme.danger,
                        fontSize: 16 * fontScale,
                      },
                    ]}
                  >
                    {diff >= 0 ? `+${diff}` : diff} kWh
                  </Text>
                </View>
              </View>

              {/* Confirm CTA */}
              <TouchableOpacity
                onPress={() => handleConfirm(currentNum, 'cyclometer')}
                style={[styles.confirmCTA, { backgroundColor: '#FF6B00' }]}
                accessibilityRole="button"
                accessibilityLabel="Confirm reading"
              >
                <Text style={[styles.confirmCTAText, { color: '#FFFFFF', fontSize: 15.5 * fontScale }]}>
                  {isEnglish ? 'Confirm Reading' : 'Kumpirmahin ang Reading'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </PageTransitionView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // STEP 1B: Electromechanical Meter Step-by-Step Guide
  // ─────────────────────────────────────────────────────────
  const electroCurrentNum = dialsToKwh(electromechanicalDials);
  const electroDiff = electroCurrentNum - previousReadingKwh;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <PageTransitionView style={{ flex: 1 }}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={() => setStage('select')}
            style={[styles.exitBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={[styles.exitBtnText, { color: theme.ink }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            {isEnglish ? 'Electromechanical Meter' : 'Electromechanical na Metro'}
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.exitBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.exitBtnText, { color: theme.ink }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
          {/* Top Banner Guide Intro */}
          <View style={[styles.instructionHeader, { paddingHorizontal: 4 }]}>
            <Text style={[styles.mainHeading, { color: theme.ink, fontSize: 22 * fontScale, fontFamily: 'Coolvetica' }]}>
              {isEnglish ? 'How to Read Dial Meters' : 'Paano Basahin ang Dial Meter'}
            </Text>
            <Text style={[styles.subHeading, { color: theme.muted, fontSize: 13 * fontScale }]}>
              {isEnglish
                ? 'Follow these 3 easy visual rules to get an accurate reading from your clock dials.'
                : 'Sundin ang 3 madaling patakaran para sa tamang pagbasa ng mga dial.'}
            </Text>
          </View>

          {/* Guide Card 1: Dials Overview */}
          <View style={[styles.guideCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.guideStepBox}>
              <Text style={[styles.stepNumberBadge, { backgroundColor: '#FF6B00', color: '#FFF' }]}>
                1
              </Text>
              <Text style={[styles.guideStepTitle, { color: theme.ink, fontSize: 14.5 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'Identify the 4 or 5 Dials' : 'Tingnan ang 4 o 5 Dials'}
              </Text>
            </View>
            <ElectromechanicalMeterGraphic size={195} />
            <Text style={[styles.guideCardText, { color: theme.muted, fontSize: 12 * fontScale }]}>
              {isEnglish
                ? 'Electromechanical meters have four (or five) dials that record electricity consumption. Read them from left to right.'
                : 'Ang mga electromechanical meter ay may apat o limang dial. Basahin ang mga ito mula kaliwa pakanan.'}
            </Text>
          </View>

          {/* Guide Card 2: Alternating Directions */}
          <View style={[styles.guideCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.guideStepBox}>
              <Text style={[styles.stepNumberBadge, { backgroundColor: '#FF6B00', color: '#FFF' }]}>
                2
              </Text>
              <Text style={[styles.guideStepTitle, { color: theme.ink, fontSize: 14.5 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'Opposite Dial Directions' : 'Salungat na Direksyon ng Dial'}
              </Text>
            </View>
            <View style={[styles.directionPillsRow, { backgroundColor: theme.cont }]}>
              <View style={styles.directionPill}>
                <Text style={[styles.directionTitle, { color: '#FF3B1D' }]}>Dial A & C</Text>
                <Text style={[styles.directionSub, { color: theme.ink }]}>↺ Counter-Clockwise</Text>
              </View>
              <View style={[styles.directionDivider, { backgroundColor: theme.line }]} />
              <View style={styles.directionPill}>
                <Text style={[styles.directionTitle, { color: '#FF3B1D' }]}>Dial B & D</Text>
                <Text style={[styles.directionSub, { color: theme.ink }]}>↻ Clockwise</Text>
              </View>
            </View>
            <Text style={[styles.guideCardText, { color: theme.muted, fontSize: 12 * fontScale }]}>
              {isEnglish
                ? 'Each adjacent dial turns in the opposite direction. Notice the numbers order on each dial.'
                : 'Ang magkatabing dial ay umiikot sa magkaibang direksyon. Pansinin ang ayos ng mga numero sa bawat dial.'}
            </Text>
          </View>

          {/* Guide Card 3: The Smaller Number Rule (Crucial Meralco Rule) */}
          <View style={[styles.guideCard, { backgroundColor: theme.surface, borderColor: '#FF6B0050' }]}>
            <View style={styles.guideStepBox}>
              <Text style={[styles.stepNumberBadge, { backgroundColor: '#FF3B1D', color: '#FFF' }]}>
                3
              </Text>
              <Text style={[styles.guideStepTitle, { color: theme.ink, fontSize: 14.5 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'Rule: Record the Smaller Number' : 'Patakaran: Itala ang Mas Maliit na Numero'}
              </Text>
            </View>
            <DialExplanationGraphic pointerBetween={[4, 5]} chosenNumber={4} />
            <Text style={[styles.guideCardText, { color: theme.ink, fontSize: 12.5 * fontScale, fontWeight: '600' }]}>
              {isEnglish
                ? 'To get your Current Reading, record the smaller number each pointer just passed.'
                : 'Kung ang karayom ay nasa pagitan ng dalawang numero, laging itala ang mas maliit na numero na dinaanan nito.'}
            </Text>
          </View>

          {/* Step 4: Input using Interactive Dial Steppers */}
          <View style={[styles.interactiveDialCard, { backgroundColor: theme.surface, borderColor: '#FF6B00' }]}>
            <View style={styles.guideStepBox}>
              <Text style={[styles.stepNumberBadge, { backgroundColor: '#FF6B00', color: '#FFF' }]}>
                4
              </Text>
              <Text style={[styles.guideStepTitle, { color: theme.ink, fontSize: 15 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? 'Set the Digits for Each Dial' : 'Itakda ang Numero ng Bawat Dial'}
              </Text>
            </View>

            {/* Dial Count Selector (4 dials vs 5 dials) */}
            <View style={[styles.dialCountSelectorRow, { backgroundColor: theme.cont }]}>
              <TouchableOpacity
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch { }
                  setDialCount(4);
                  const updated = [...electromechanicalDials];
                  updated[0] = 0; // Lock 10,000s digit to 0 for 4 dials
                  setElectromechanicalDials(updated);
                }}
                style={[
                  styles.dialCountOption,
                  dialCount === 4 && { backgroundColor: theme.brand },
                ]}
                accessibilityRole="button"
                accessibilityLabel="4 Dials"
              >
                <Text
                  style={[
                    styles.dialCountOptionText,
                    {
                      color: dialCount === 4 ? theme.brandInk : theme.ink,
                      fontWeight: '800',
                      fontSize: 12.5 * fontScale,
                    },
                  ]}
                >
                  {isEnglish ? '4 Dials (First digit = 0)' : '4 Dials (Unang digit = 0)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  try { Haptics.selectionAsync(); } catch { }
                  setDialCount(5);
                }}
                style={[
                  styles.dialCountOption,
                  dialCount === 5 && { backgroundColor: theme.brand },
                ]}
                accessibilityRole="button"
                accessibilityLabel="5 Dials"
              >
                <Text
                  style={[
                    styles.dialCountOptionText,
                    {
                      color: dialCount === 5 ? theme.brandInk : theme.ink,
                      fontWeight: '800',
                      fontSize: 12.5 * fontScale,
                    },
                  ]}
                >
                  {isEnglish ? '5 Dials' : '5 Dials'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.steppersRow}>
              {electromechanicalDials.map((digit, idx) => {
                const isLockedZero = dialCount === 4 && idx === 0;

                return (
                  <View key={idx} style={styles.stepperCol}>
                    {/* Up button */}
                    <TouchableOpacity
                      onPress={() => handleStepDial(idx, 1)}
                      disabled={isLockedZero}
                      style={[
                        styles.stepBtn,
                        {
                          backgroundColor: isLockedZero ? theme.bg : theme.cont,
                          borderColor: theme.line,
                          opacity: isLockedZero ? 0.3 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Increase dial ${idx + 1}`}
                    >
                      <Text style={[styles.stepBtnText, { color: isLockedZero ? theme.muted : '#FF6B00' }]}>
                        ▲
                      </Text>
                    </TouchableOpacity>

                    {/* Digit Box */}
                    <View
                      style={[
                        styles.stepperBox,
                        {
                          backgroundColor: isLockedZero ? theme.cont : theme.bg,
                          borderColor: isLockedZero ? theme.line : '#FF6B00',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepperValueText,
                          {
                            color: isLockedZero ? theme.muted : '#FF6B00',
                            fontSize: 22 * fontScale,
                          },
                        ]}
                      >
                        {isLockedZero ? 0 : digit}
                      </Text>
                    </View>

                    {/* Down button */}
                    <TouchableOpacity
                      onPress={() => handleStepDial(idx, -1)}
                      disabled={isLockedZero}
                      style={[
                        styles.stepBtn,
                        {
                          backgroundColor: isLockedZero ? theme.bg : theme.cont,
                          borderColor: theme.line,
                          opacity: isLockedZero ? 0.3 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Decrease dial ${idx + 1}`}
                    >
                      <Text style={[styles.stepBtnText, { color: isLockedZero ? theme.muted : '#FF6B00' }]}>
                        ▼
                      </Text>
                    </TouchableOpacity>

                    <Text style={[styles.stepperColLabel, { color: theme.muted, fontSize: 9.5 * fontScale }]}>
                      {isLockedZero ? (isEnglish ? 'Fixed 0' : 'Naka-0') : DIAL_POSITIONS[idx]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Delta & Calculation Preview */}
          <View style={[styles.calcPreviewCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
                {isEnglish ? 'Current Reading' : 'Kasalukuyang Reading'}
              </Text>
              <Text style={[styles.calcVal, { color: theme.ink, fontSize: 14 * fontScale }]}>
                {electroCurrentNum.toLocaleString()} kWh
              </Text>
            </View>
            <View style={styles.calcRow}>
              <Text style={[styles.calcLabel, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
                {isEnglish ? 'Less Previous Reading' : 'Nakaraang Reading'}
              </Text>
              <Text style={[styles.calcVal, { color: theme.muted, fontSize: 14 * fontScale }]}>
                {previousReadingKwh.toLocaleString()} kWh
              </Text>
            </View>
            <View style={[styles.calcRow, styles.calcRowTotal, { borderTopColor: theme.line }]}>
              <Text style={[styles.calcLabelBold, { color: theme.ink, fontSize: 13.5 * fontScale }]}>
                {isEnglish ? 'Total kWh Used' : 'Kabuuang Gamit'}
              </Text>
              <Text
                style={[
                  styles.calcValBold,
                  {
                    color: electroDiff >= 0 ? '#FF6B00' : theme.danger,
                    fontSize: 16 * fontScale,
                  },
                ]}
              >
                {electroDiff >= 0 ? `+${electroDiff}` : electroDiff} kWh
              </Text>
            </View>
          </View>

          {/* Confirm CTA */}
          <TouchableOpacity
            onPress={() => handleConfirm(electroCurrentNum, 'dial')}
            style={[styles.confirmCTA, { backgroundColor: '#FF6B00' }]}
            accessibilityRole="button"
            accessibilityLabel="Confirm electromechanical reading"
          >
            <Text style={[styles.confirmCTAText, { color: '#FFFFFF', fontSize: 15.5 * fontScale }]}>
              {isEnglish ? 'Confirm Reading' : 'Kumpirmahin ang Reading'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </PageTransitionView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FF6B0022',
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exitBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  topBarTitle: {
    fontWeight: '700',
    fontFamily: 'Coolvetica',
    letterSpacing: 0.2,
  },
  selectionScroll: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },
  stepScroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  instructionHeader: {
    marginBottom: 20,
  },
  mainHeading: {
    fontWeight: '800',
    marginBottom: 6,
  },
  subHeading: {
    lineHeight: 19,
    fontWeight: '400',
  },
  cardsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  meterTypeCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 260,
  },
  graphicWrapper: {
    marginVertical: 10,
  },
  cardTitle: {
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 4,
  },
  cardSubtitle: {
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 3,
    marginBottom: 10,
  },
  pickBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  pickBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tipCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  tipTitle: {
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: 'Coolvetica',
  },
  tipBody: {
    lineHeight: 18,
  },
  detectedBadgePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 4,
  },
  detectedBadgePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  autoDetectedCard: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  detectedGraphicHeader: {
    marginVertical: 12,
    alignItems: 'center',
  },
  detectedSpecBox: {
    width: '100%',
    borderRadius: 12,
    padding: 12,
    marginVertical: 10,
    alignItems: 'center',
  },
  detectedSpecTitle: {
    fontWeight: '800',
    marginBottom: 3,
  },
  detectedSpecSub: {
    textAlign: 'center',
  },
  proceedCTA: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  proceedCTAText: {
    fontWeight: '800',
  },
  switchTypeButton: {
    paddingVertical: 10,
    marginTop: 4,
  },
  switchTypeText: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Step 1A Styles
  diagramCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  diagramBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FF3B1D12',
  },
  diagramBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  guideStepBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '900',
    fontSize: 13,
  },
  guideStepTitle: {
    fontWeight: '800',
    marginBottom: 2,
  },
  guideStepDesc: {
    lineHeight: 18,
  },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontWeight: '700',
    marginBottom: 12,
  },
  digitBoxesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  digitBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBoxText: {
    fontWeight: '900',
  },
  kwhPill: {
    marginLeft: 6,
    justifyContent: 'center',
  },
  kwhPillText: {
    fontWeight: '800',
    fontSize: 14,
  },
  hiddenRealInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 16,
  },

  // Calculation preview
  calcPreviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcRowTotal: {
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  calcLabel: {
    fontWeight: '500',
  },
  calcVal: {
    fontWeight: '700',
  },
  calcLabelBold: {
    fontWeight: '800',
  },
  calcValBold: {
    fontWeight: '900',
  },
  confirmCTA: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmCTAText: {
    fontWeight: '800',
  },

  // Step 1B Styles
  guideCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  guideCardText: {
    lineHeight: 18,
    marginTop: 8,
  },
  directionPillsRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 10,
    marginVertical: 8,
  },
  directionPill: {
    flex: 1,
    alignItems: 'center',
  },
  directionTitle: {
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 2,
  },
  directionSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  directionDivider: {
    width: 1,
    height: '100%',
  },
  interactiveDialCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 16,
  },
  dialCountSelectorRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginVertical: 10,
    gap: 6,
  },
  dialCountOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialCountOptionText: {
    textAlign: 'center',
  },
  steppersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 10,
  },
  sectionHint: {
    lineHeight: 16,
  },
  stepperCol: {
    flex: 1,
    alignItems: 'center',
  },
  stepBtn: {
    width: '100%',
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '900',
  },
  stepperBox: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueText: {
    fontWeight: '900',
  },
  stepperColLabel: {
    fontWeight: '700',
    marginTop: 3,
  },
});

