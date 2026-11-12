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
  Image,
} from 'react-native';
import Svg, { Circle, Line, G, Text as SvgText, Rect, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { AnalogMeterLogEntry, AnalogMeterType } from '../types/analogMeter';
import {
  dialsToKwh,
  kwhToDials,
  calculateWeeklyAnalogDelta,
} from '../services/analogMeterService';

export interface AnalogMeterVerificationDrawerProps {
  visible: boolean;
  can: string;
  initialReadingKwh?: number;
  initialDials?: number[];
  initialMeterType?: AnalogMeterType;
  initialDaysElapsed?: number;
  previousReadingKwh?: number;
  photoUri?: string;
  effectiveRate?: number;
  onConfirm: (entry: AnalogMeterLogEntry) => void;
  onRetake: () => void;
  onCancel: () => void;
  onOpenGuide?: () => void;
  testID?: string;
}

const DIAL_LABELS = ['10,000s', '1,000s', '100s', '10s', '1s'];
const ELAPSED_WEEK_OPTIONS = [
  { days: 7, label: '1 Linggo (7d)' },
  { days: 14, label: '2 Linggo (14d)' },
  { days: 21, label: '3 Linggo (21d)' },
  { days: 28, label: '4 Linggo (28d)' },
];

// Reusable SVG illustration: Dial meter face
const ElectromechanicalMeterGraphic = ({ size = 180 }: { size?: number }) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 160 160">
      <Circle cx="80" cy="80" r="72" fill="#DCE7DD" stroke="#9EABA0" strokeWidth="6" />
      <Circle cx="80" cy="80" r="66" fill="#EEF4EF" stroke="#CAD5CB" strokeWidth="2" />
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
      <Circle cx="40" cy="68" r="10" fill="#2E3830" />
      {/* 4 Clock Dials */}
      <G transform="translate(62, 68)">
        <Circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#5D6D60" strokeWidth="1.2" />
        <Line x1="0" y1="0" x2="-5" y2="-4" stroke="#D32F2F" strokeWidth="1.6" strokeLinecap="round" />
        <Circle cx="0" cy="0" r="1.5" fill="#1C1C1C" />
      </G>
      <G transform="translate(84, 68)">
        <Circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#5D6D60" strokeWidth="1.2" />
        <Line x1="0" y1="0" x2="5" y2="-4" stroke="#D32F2F" strokeWidth="1.6" strokeLinecap="round" />
        <Circle cx="0" cy="0" r="1.5" fill="#1C1C1C" />
      </G>
      <G transform="translate(106, 68)">
        <Circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#5D6D60" strokeWidth="1.2" />
        <Line x1="0" y1="0" x2="-4" y2="4" stroke="#D32F2F" strokeWidth="1.6" strokeLinecap="round" />
        <Circle cx="0" cy="0" r="1.5" fill="#1C1C1C" />
      </G>
      <G transform="translate(128, 68)">
        <Circle cx="0" cy="0" r="9" fill="#FFFFFF" stroke="#5D6D60" strokeWidth="1.2" />
        <Line x1="0" y1="0" x2="4" y2="4" stroke="#D32F2F" strokeWidth="1.6" strokeLinecap="round" />
        <Circle cx="0" cy="0" r="1.5" fill="#1C1C1C" />
      </G>
      <SvgText x="80" y="92" fill="#2E3B30" fontSize="7" fontWeight="bold" textAnchor="middle">
        KILOWATTHOURS
      </SvgText>
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

// Reusable SVG illustration: Smaller number pointer rule
const DialExplanationGraphic = ({ chosenNumber = 4 }: { chosenNumber?: number }) => (
  <View style={{ alignItems: 'center', marginVertical: 8 }}>
    <Svg width={250} height={175} viewBox="0 0 180 130">
      <Circle cx="90" cy="65" r="50" fill="#F4F8F4" stroke="#4C6350" strokeWidth="3" />
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
      <G transform="translate(90, 65)">
        <Line x1="0" y1="0" x2="24" y2="20" stroke="#111812" strokeWidth="3" strokeLinecap="round" />
        <Circle cx="0" cy="0" r="4" fill="#111812" />
      </G>
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

export const AnalogMeterVerificationDrawer: React.FC<AnalogMeterVerificationDrawerProps> = ({
  visible,
  can,
  initialReadingKwh = 14285,
  initialDials,
  initialMeterType = 'dial',
  initialDaysElapsed = 7,
  previousReadingKwh = 14240,
  photoUri,
  effectiveRate = 11.43,
  onConfirm,
  onRetake,
  onCancel,
  onOpenGuide,
  testID = 'analog-verification-drawer',
}) => {
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';

  const [dials, setDials] = useState<number[]>([1, 4, 2, 8, 5]);
  const [kwhInput, setKwhInput] = useState<string>('14285');
  const [photoExpanded, setPhotoExpanded] = useState<boolean>(false);
  const [selectedMeterType, setSelectedMeterType] = useState<AnalogMeterType>(initialMeterType);
  const [selectedDaysElapsed, setSelectedDaysElapsed] = useState<number>(initialDaysElapsed);
  const [guideModalVisible, setGuideModalVisible] = useState<boolean>(false);

  useEffect(() => {
    if (initialDials && initialDials.length === 5) {
      setDials(initialDials);
      const computedKwh = dialsToKwh(initialDials);
      setKwhInput(computedKwh.toString());
    } else if (typeof initialReadingKwh === 'number') {
      const d = kwhToDials(initialReadingKwh);
      setDials(d);
      setKwhInput(initialReadingKwh.toString());
    }
    setSelectedMeterType(initialMeterType || 'dial');
    setSelectedDaysElapsed(initialDaysElapsed || 7);
  }, [initialReadingKwh, initialDials, initialMeterType, initialDaysElapsed, visible]);

  const handleDialStep = (index: number, step: 1 | -1) => {
    const nextDials = [...dials];
    nextDials[index] = (nextDials[index] + step + 10) % 10;
    setDials(nextDials);
    const newKwh = dialsToKwh(nextDials);
    setKwhInput(newKwh.toString());
  };

  const handleKwhInputChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, '').slice(0, 5);
    setKwhInput(numericText);
    const val = parseInt(numericText, 10);
    if (!isNaN(val)) {
      setDials(kwhToDials(val));
    }
  };

  const currentReadingNumber = parseInt(kwhInput, 10) || dialsToKwh(dials);
  const deltaCalc = calculateWeeklyAnalogDelta(
    currentReadingNumber,
    previousReadingKwh,
    selectedDaysElapsed,
    effectiveRate
  );

  const isNegativeDelta = deltaCalc.weeklyUsageKwh < 0 && !deltaCalc.isRollover;
  const isSpike = deltaCalc.normalizedWeeklyKwh > 150;

  const handleSave = () => {
    const entry: AnalogMeterLogEntry = {
      id: `analog-${Date.now()}`,
      can,
      timestamp: new Date().toISOString(),
      readingKwh: currentReadingNumber,
      weeklyUsageKwh: deltaCalc.weeklyUsageKwh,
      daysSinceLastReading: selectedDaysElapsed,
      normalizedWeeklyKwh: deltaCalc.normalizedWeeklyKwh,
      costEstimate: deltaCalc.costEstimate,
      photoUri,
      verifiedByUser: true,
      meterType: selectedMeterType,
      dials,
      notes: isNegativeDelta
        ? 'May warning: Mas mababang reading'
        : isSpike
        ? 'May warning: Spike sa konsumo'
        : selectedDaysElapsed >= 14
        ? `Na-interpolate sa ${Math.round(selectedDaysElapsed / 7)} linggo`
        : undefined,
    };
    onConfirm(entry);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent testID={testID}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, borderColor: theme.line },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.title, { color: theme.ink, fontSize: 18 * fontScale }]}>
                {isEnglish ? 'Review & Verify Reading' : 'Suriin at I-verify ang Reading'}
              </Text>
              <TouchableOpacity
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel={isEnglish ? 'Cancel verification' : 'Kanselahin ang verification'}
                style={[styles.closeMiniBtn, { backgroundColor: theme.cont }]}
              >
                <Text style={[styles.closeMiniText, { color: theme.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.subtitle, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
              {isEnglish
                ? 'Check the dials against the photo before saving weekly usage.'
                : 'I-tsek ang mga dial laban sa litrato bago i-save ang lingguhang konsumo.'}
            </Text>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Photo Thumbnail + Zoom Toggle */}
            {photoUri ? (
              <View style={styles.photoContainer}>
                <TouchableOpacity
                  onPress={() => setPhotoExpanded((prev) => !prev)}
                  activeOpacity={0.85}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="I-expand o i-zoom ang litrato ng meter"
                  style={[
                    styles.photoWrapper,
                    photoExpanded ? styles.photoWrapperExpanded : styles.photoWrapperNormal,
                    { borderColor: theme.line },
                  ]}
                >
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.photoImage}
                    resizeMode={photoExpanded ? 'contain' : 'cover'}
                  />
                  <View style={[styles.zoomPill, { backgroundColor: theme.ink + 'CC' }]}>
                    <Text style={styles.zoomPillText}>
                      {photoExpanded ? 'I-minimize' : 'I-tap para i-zoom'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Meter Subtype & Elapsed Weeks Controls */}
            <View style={[styles.cardSection, { backgroundColor: theme.cont, borderColor: theme.line }]}>
              <Text style={[styles.sectionTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {isEnglish ? 'Analog Meter Type' : 'Uri ng Analog Meter'}
              </Text>
              <View style={styles.pillToggleRow}>
                <TouchableOpacity
                  testID="drawer-subtype-dial"
                  style={[
                    styles.pillToggleBtn,
                    {
                      backgroundColor: selectedMeterType === 'dial' ? theme.brand : theme.surface,
                      borderColor: selectedMeterType === 'dial' ? theme.brand : theme.line,
                    },
                  ]}
                  onPress={() => setSelectedMeterType('dial')}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: selectedMeterType === 'dial' ? theme.brandInk : theme.ink,
                      fontWeight: '700',
                      fontSize: 12 * fontScale,
                    }}
                  >
                    5-Dial Pointer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="drawer-subtype-cyclometer"
                  style={[
                    styles.pillToggleBtn,
                    {
                      backgroundColor: selectedMeterType === 'cyclometer' ? theme.brand : theme.surface,
                      borderColor: selectedMeterType === 'cyclometer' ? theme.brand : theme.line,
                    },
                  ]}
                  onPress={() => setSelectedMeterType('cyclometer')}
                  accessibilityRole="button"
                >
                  <Text
                    style={{
                      color: selectedMeterType === 'cyclometer' ? theme.brandInk : theme.ink,
                      fontWeight: '700',
                      fontSize: 12 * fontScale,
                    }}
                  >
                    Mechanical Drum
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.ink, fontSize: 13 * fontScale, marginTop: 10 }]}>
                {isEnglish ? 'Elapsed Weeks (Missed Weeks Handling)' : 'Lumipas na Linggo (Missed Weeks Handling)'}
              </Text>
              <View style={styles.pillToggleRow}>
                {ELAPSED_WEEK_OPTIONS.map((opt) => {
                  const active = selectedDaysElapsed === opt.days;
                  const labelText = isEnglish
                    ? `${opt.days / 7} ${opt.days === 7 ? 'Week' : 'Weeks'} (${opt.days}d)`
                    : opt.label;
                  return (
                    <TouchableOpacity
                      key={opt.days}
                      testID={`elapsed-days-${opt.days}`}
                      style={[
                        styles.pillToggleBtn,
                        {
                          backgroundColor: active ? theme.brand : theme.surface,
                          borderColor: active ? theme.brand : theme.line,
                        },
                      ]}
                      onPress={() => setSelectedDaysElapsed(opt.days)}
                      accessibilityRole="button"
                    >
                      <Text
                        style={{
                          color: active ? theme.brandInk : theme.ink,
                          fontWeight: '700',
                          fontSize: 10.5 * fontScale,
                        }}
                      >
                        {labelText}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Interactive 5-Dial / 5-Drum Steppers */}
            <View style={[styles.cardSection, { backgroundColor: theme.cont, borderColor: theme.line }]}>
              <View style={styles.sectionTitleWithGuideRow}>
                <Text style={[styles.sectionTitle, { color: theme.ink, fontSize: 13.5 * fontScale, flex: 1 }]}>
                  {selectedMeterType === 'cyclometer'
                    ? 'Interactive 5-Drum Cyclometer Pickers'
                    : 'Interactive 5-Dial Pickers'}
                </Text>

                {/* View Instructions Button for cross-checking electromechanical dials */}
                {selectedMeterType === 'dial' && (
                  <TouchableOpacity
                    style={[styles.guideCrossCheckBtn, { borderColor: '#FF6B00', backgroundColor: theme.surface }]}
                    onPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                      setGuideModalVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={isEnglish ? 'View how to read dials' : 'Tingnan ang gabay sa pagbasa'}
                  >
                    <Text style={[styles.guideCrossCheckText, { color: '#FF6B00', fontSize: 11 * fontScale }]}>
                      {isEnglish ? 'How to Read Dials' : 'Paano Basahin'} ➔
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={[styles.sectionHint, { color: theme.muted, fontSize: 11.5 * fontScale }]}>
                {isEnglish
                  ? 'Press + or - to match each dial to the photo. If needle is between numbers, choose the smaller number.'
                  : 'Pindutin ang + o - upang itugma ang bawat dial sa litrato. Kung nasa pagitan, piliin ang mas maliit.'}
              </Text>

              <View style={styles.dialSteppersRow}>
                {dials.map((digit, idx) => (
                  <View key={idx} style={styles.dialCol}>
                    <TouchableOpacity
                      style={[styles.dialStepBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
                      onPress={() => handleDialStep(idx, 1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Dagdagan ang ${DIAL_LABELS[idx]} dial`}
                    >
                      <Text style={[styles.dialStepBtnText, { color: theme.brand }]}>▲</Text>
                    </TouchableOpacity>

                    <View
                      style={[
                        styles.dialValueBox,
                        { backgroundColor: theme.surface, borderColor: theme.brand },
                      ]}
                    >
                      <Text style={[styles.dialValueText, { color: theme.brand, fontSize: 20 * fontScale }]}>
                        {digit}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.dialStepBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
                      onPress={() => handleDialStep(idx, -1)}
                      accessibilityRole="button"
                      accessibilityLabel={`Bawasan ang ${DIAL_LABELS[idx]} dial`}
                    >
                      <Text style={[styles.dialStepBtnText, { color: theme.brand }]}>▼</Text>
                    </TouchableOpacity>

                    <Text style={[styles.dialColLabel, { color: theme.muted, fontSize: 9.5 * fontScale }]}>
                      {DIAL_LABELS[idx]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Cumulative Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.ink, fontSize: 13.5 * fontScale }]}>
                {isEnglish ? 'Cumulative Meter Reading (Total kWh)' : 'Kabuuang Reading sa Metro (Cumulative kWh)'}
              </Text>
              <View style={styles.inputContainerRow}>
                <TextInput
                  style={[
                    styles.kwhTextInput,
                    {
                      backgroundColor: theme.bg,
                      borderColor: theme.line,
                      color: theme.ink,
                      fontSize: 18 * fontScale,
                    },
                  ]}
                  value={kwhInput}
                  onChangeText={handleKwhInputChange}
                  keyboardType="numeric"
                  maxLength={5}
                  accessibilityLabel="Cumulative kWh input"
                />
                <View style={[styles.unitBadge, { backgroundColor: theme.cont }]}>
                  <Text style={[styles.unitText, { color: theme.muted, fontSize: 13 * fontScale }]}>
                    kWh
                  </Text>
                </View>
              </View>
            </View>

            {/* Delta & Cost Calculation Preview Card */}
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.line,
                },
              ]}
            >
              <View style={styles.previewRow}>
                <View style={styles.previewCol}>
                  <Text style={[styles.previewLabel, { color: theme.muted, fontSize: 11.5 * fontScale }]}>
                    {isEnglish ? 'Previous Reading' : 'Nakaraang Reading'}
                  </Text>
                  <Text style={[styles.previewVal, { color: theme.ink, fontSize: 15 * fontScale }]}>
                    {previousReadingKwh.toLocaleString()} kWh
                  </Text>
                </View>

                <View style={styles.previewCol}>
                  <Text style={[styles.previewLabel, { color: theme.muted, fontSize: 11.5 * fontScale }]}>
                    {isEnglish ? 'This Week Usage' : 'Konsumo Ngayong Linggo'}
                  </Text>
                  <Text
                    style={[
                      styles.previewVal,
                      {
                        color: isNegativeDelta ? theme.danger : theme.brand,
                        fontSize: 16 * fontScale,
                        fontWeight: '800',
                      },
                    ]}
                  >
                    {deltaCalc.weeklyUsageKwh >= 0 ? `+${deltaCalc.weeklyUsageKwh}` : deltaCalc.weeklyUsageKwh} kWh
                  </Text>
                </View>

                <View style={styles.previewCol}>
                  <Text style={[styles.previewLabel, { color: theme.muted, fontSize: 11.5 * fontScale }]}>
                    {isEnglish ? 'Estimated Cost' : 'Tinatayang Halaga'}
                  </Text>
                  <Text style={[styles.previewVal, { color: theme.ok, fontSize: 15 * fontScale, fontWeight: '800' }]}>
                    ₱{deltaCalc.costEstimate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </View>
            </View>

            {/* Anomaly Alerts */}
            {isNegativeDelta && (
              <View
                style={[
                  styles.alertBox,
                  { backgroundColor: theme.dangerBg, borderColor: theme.danger },
                ]}
              >
                <Text style={[styles.alertTitle, { color: theme.danger, fontSize: 13 * fontScale }]}>
                  {isEnglish ? 'Lower Reading Warning!' : 'Mas Mababa ang Reading!'}
                </Text>
                <Text style={[styles.alertBody, { color: theme.ink, fontSize: 12 * fontScale }]}>
                  {isEnglish
                    ? `Current reading (${currentReadingNumber} kWh) is lower than previous (${previousReadingKwh} kWh). Please recheck the photo dials.`
                    : `Ang kasalukuyang reading (${currentReadingNumber} kWh) ay mas mababa kaysa nakaraan (${previousReadingKwh} kWh). Pakitiyak ang mga dial sa litrato.`}
                </Text>
              </View>
            )}

            {isSpike && (
              <View
                style={[
                  styles.alertBox,
                  { backgroundColor: theme.warnBg, borderColor: theme.warn },
                ]}
              >
                <Text style={[styles.alertTitle, { color: theme.warn, fontSize: 13 * fontScale }]}>
                  {isEnglish ? 'Consumption Spike Alert!' : 'Spike Alert sa Konsumo!'}
                </Text>
                <Text style={[styles.alertBody, { color: theme.ink, fontSize: 12 * fontScale }]}>
                  {isEnglish
                    ? `Weekly usage exceeds 150 kWh (${deltaCalc.weeklyUsageKwh} kWh). Ensure proper reading of 10,000s and 1,000s dials.`
                    : `Lampas sa 150 kWh ang konsumo para sa isang linggo (${deltaCalc.weeklyUsageKwh} kWh). Siguraduhing tama ang pagbasa sa 10,000s at 1,000s dials.`}
                </Text>
              </View>
            )}

            {deltaCalc.isRollover && (
              <View
                style={[
                  styles.alertBox,
                  { backgroundColor: theme.okBg, borderColor: theme.ok },
                ]}
              >
                <Text style={[styles.alertTitle, { color: theme.ok, fontSize: 13 * fontScale }]}>
                  {isEnglish ? '5-Dial Rollover Detected' : '5-Dial Rollover Na-detect'}
                </Text>
                <Text style={[styles.alertBody, { color: theme.ink, fontSize: 12 * fontScale }]}>
                  {isEnglish
                    ? `Meter exceeded 99,999 back to 00,000. Calculated weekly usage is ${deltaCalc.weeklyUsageKwh} kWh.`
                    : `Lumampas na sa 99,999 pabalik sa 00,000 ang metro. Ang kalkuladong lingguhang konsumo ay ${deltaCalc.weeklyUsageKwh} kWh.`}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.actionsRow, { borderTopColor: theme.line }]}>
            <TouchableOpacity
              style={[styles.retakeBtn, { borderColor: theme.line, backgroundColor: theme.bg }]}
              onPress={onRetake}
              accessibilityRole="button"
              accessibilityLabel={isEnglish ? 'Retake photo' : 'Kumuha muli ng litrato'}
            >
              <Text style={[styles.retakeBtnText, { color: theme.ink, fontSize: 14 * fontScale }]}>
                {isEnglish ? 'Retake' : 'Kumuha Muli'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: theme.brand }]}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel={isEnglish ? 'Confirm and save reading' : 'Kumpirmahin at I-save ang reading'}
            >
              <Text style={[styles.confirmBtnText, { color: theme.brandInk, fontSize: 14.5 * fontScale }]}>
                {isEnglish ? 'Confirm & Save' : 'Kumpirmahin at I-save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Internal Electromechanical Reading Instructions Popup Modal */}
      <Modal
        visible={guideModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setGuideModalVisible(false)}
      >
        <View style={styles.guideModalBackdrop}>
          <View style={[styles.guideModalSheet, { backgroundColor: theme.surface, borderColor: '#FF6B0040' }]}>
            {/* Guide Header */}
            <View style={[styles.guideModalHeader, { borderBottomColor: theme.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.guideModalSuper, { color: '#FF6B00', fontSize: 11 * fontScale }]}>
                  {isEnglish ? 'REFERENCE GUIDE' : 'GABAY SA PAGBASA'}
                </Text>
                <Text style={[styles.guideModalTitle, { color: theme.ink, fontSize: 17 * fontScale }]}>
                  {isEnglish ? 'How to Read Dial Meters' : 'Paano Basahin ang Dial Meter'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setGuideModalVisible(false)}
                style={[styles.closeMiniBtn, { backgroundColor: theme.cont }]}
                accessibilityRole="button"
                accessibilityLabel="Close guide"
              >
                <Text style={[styles.closeMiniText, { color: theme.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Scrollable Step-by-Step Instructions */}
            <ScrollView style={styles.guideModalScroll} showsVerticalScrollIndicator={false}>
              {/* Step 1: Dials Identification */}
              <View style={[styles.guideCard, { backgroundColor: theme.cont, borderColor: theme.line }]}>
                <View style={styles.guideStepHeaderRow}>
                  <Text style={[styles.guideStepNum, { backgroundColor: '#FF6B00', color: '#FFF' }]}>1</Text>
                  <Text style={[styles.guideCardHeading, { color: theme.ink, fontSize: 14 * fontScale }]}>
                    {isEnglish ? 'Identify the 4 or 5 Dials' : 'Tingnan ang 4 o 5 Dials'}
                  </Text>
                </View>
                <ElectromechanicalMeterGraphic size={170} />
                <Text style={[styles.guideCardBodyText, { color: theme.muted, fontSize: 12 * fontScale }]}>
                  {isEnglish
                    ? 'Electromechanical meters have four (or five) dials that record electricity consumption. Read them from left to right.'
                    : 'Ang mga electromechanical meter ay may apat o limang dial. Basahin ang mga ito mula kaliwa pakanan.'}
                </Text>
              </View>

              {/* Step 2: Opposite Directions */}
              <View style={[styles.guideCard, { backgroundColor: theme.cont, borderColor: theme.line }]}>
                <View style={styles.guideStepHeaderRow}>
                  <Text style={[styles.guideStepNum, { backgroundColor: '#FF6B00', color: '#FFF' }]}>2</Text>
                  <Text style={[styles.guideCardHeading, { color: theme.ink, fontSize: 14 * fontScale }]}>
                    {isEnglish ? 'Opposite Dial Directions' : 'Salungat na Direksyon ng Dial'}
                  </Text>
                </View>
                <View style={[styles.guideDirectionRow, { backgroundColor: theme.surface }]}>
                  <View style={styles.guideDirectionCol}>
                    <Text style={[styles.directionTitle, { color: '#FF3B1D' }]}>Dial A & C</Text>
                    <Text style={[styles.directionSub, { color: theme.ink }]}>↺ Counter-Clockwise</Text>
                  </View>
                  <View style={[styles.directionDivider, { backgroundColor: theme.line }]} />
                  <View style={styles.guideDirectionCol}>
                    <Text style={[styles.directionTitle, { color: '#FF3B1D' }]}>Dial B & D</Text>
                    <Text style={[styles.directionSub, { color: theme.ink }]}>↻ Clockwise</Text>
                  </View>
                </View>
                <Text style={[styles.guideCardBodyText, { color: theme.muted, fontSize: 12 * fontScale }]}>
                  {isEnglish
                    ? 'Each adjacent dial turns in the opposite direction. Notice the number arrangement on each clock dial.'
                    : 'Ang magkatabing dial ay umiikot sa magkaibang direksyon. Pansinin ang ayos ng mga numero sa bawat dial.'}
                </Text>
              </View>

              {/* Step 3: Smaller Number Rule */}
              <View style={[styles.guideCard, { backgroundColor: theme.cont, borderColor: '#FF6B0050' }]}>
                <View style={styles.guideStepHeaderRow}>
                  <Text style={[styles.guideStepNum, { backgroundColor: '#FF3B1D', color: '#FFF' }]}>3</Text>
                  <Text style={[styles.guideCardHeading, { color: theme.ink, fontSize: 14 * fontScale }]}>
                    {isEnglish ? 'Rule: Record the Smaller Number' : 'Patakaran: Itala ang Mas Maliit na Numero'}
                  </Text>
                </View>
                <DialExplanationGraphic chosenNumber={4} />
                <Text style={[styles.guideCardBodyText, { color: theme.ink, fontSize: 12.5 * fontScale, fontWeight: '600' }]}>
                  {isEnglish
                    ? 'To get your Current Reading, record the smaller number each pointer just passed.'
                    : 'Kung ang karayom ay nasa pagitan ng dalawang numero, laging itala ang mas maliit na numero na dinaanan nito.'}
                </Text>
              </View>

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Close Button */}
            <TouchableOpacity
              onPress={() => setGuideModalVisible(false)}
              style={[styles.guideModalCloseBtn, { backgroundColor: '#FF6B00' }]}
              accessibilityRole="button"
              accessibilityLabel="Got it, close instructions"
            >
              <Text style={[styles.guideModalCloseBtnText, { color: '#FFFFFF', fontSize: 14.5 * fontScale }]}>
                {isEnglish ? 'Got It, Return to Dials' : 'Naintindihan Ko, Bumalik sa mga Dial'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '92%',
  },
  header: {
    marginBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
  },
  closeMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeMiniText: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    lineHeight: 17,
  },
  scrollBody: {
    marginVertical: 4,
  },
  photoContainer: {
    marginBottom: 12,
    alignItems: 'center',
  },
  photoWrapper: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  photoWrapperNormal: {
    width: '100%',
    height: 140,
  },
  photoWrapperExpanded: {
    width: '100%',
    height: 260,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  zoomPill: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  zoomPillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '800',
  },
  sectionTitleWithGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  guideCrossCheckBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  guideCrossCheckText: {
    fontWeight: '800',
  },
  sectionHint: {
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 10,
  },
  pillToggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  pillToggleBtn: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialSteppersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dialCol: {
    flex: 1,
    alignItems: 'center',
  },
  dialStepBtn: {
    width: '100%',
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialStepBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  dialValueBox: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialValueText: {
    fontWeight: '900',
  },
  dialColLabel: {
    fontWeight: '700',
    marginTop: 3,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontWeight: '700',
    marginBottom: 6,
  },
  inputContainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kwhTextInput: {
    flex: 1,
    height: 48,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1.5,
    borderRightWidth: 0,
    paddingHorizontal: 14,
    fontWeight: '800',
  },
  unitBadge: {
    height: 48,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 1.5,
    borderLeftWidth: 0,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitText: {
    fontWeight: '800',
  },
  previewCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  previewCol: {
    flex: 1,
    alignItems: 'center',
  },
  previewLabel: {
    fontWeight: '600',
    marginBottom: 3,
    textAlign: 'center',
  },
  previewVal: {
    fontWeight: '700',
    textAlign: 'center',
  },
  alertBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  alertTitle: {
    fontWeight: '800',
    marginBottom: 3,
  },
  alertBody: {
    lineHeight: 17,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  retakeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeBtnText: {
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontWeight: '800',
  },

  // Guide Popup Modal Styles
  guideModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  guideModalSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  guideModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 10,
  },
  guideModalSuper: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  guideModalTitle: {
    fontWeight: '800',
    fontFamily: 'Coolvetica',
  },
  guideModalScroll: {
    maxHeight: 460,
  },
  guideCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  guideStepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  guideStepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '900',
    fontSize: 12,
  },
  guideCardHeading: {
    fontWeight: '800',
    fontFamily: 'Coolvetica',
  },
  guideCardBodyText: {
    lineHeight: 18,
    marginTop: 8,
  },
  guideDirectionRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
  },
  guideDirectionCol: {
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
  guideModalCloseBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  guideModalCloseBtnText: {
    fontWeight: '800',
  },
});
