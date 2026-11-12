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
  testID?: string;
}

const DIAL_LABELS = ['10,000s', '1,000s', '100s', '10s', '1s'];
const ELAPSED_WEEK_OPTIONS = [
  { days: 7, label: '1 Linggo (7d)' },
  { days: 14, label: '2 Linggo (14d)' },
  { days: 21, label: '3 Linggo (21d)' },
  { days: 28, label: '4 Linggo (28d)' },
];

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
  testID = 'analog-verification-drawer',
}) => {
  const { theme, fontScale } = useTheme();

  const [dials, setDials] = useState<number[]>([1, 4, 2, 8, 5]);
  const [kwhInput, setKwhInput] = useState<string>('14285');
  const [photoExpanded, setPhotoExpanded] = useState<boolean>(false);
  const [selectedMeterType, setSelectedMeterType] = useState<AnalogMeterType>(initialMeterType);
  const [selectedDaysElapsed, setSelectedDaysElapsed] = useState<number>(initialDaysElapsed);

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
                Suriin at I-verify ang Reading
              </Text>
              <TouchableOpacity
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Kanselahin ang verification"
                style={[styles.closeMiniBtn, { backgroundColor: theme.cont }]}
              >
                <Text style={[styles.closeMiniText, { color: theme.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.subtitle, { color: theme.muted, fontSize: 12.5 * fontScale }]}>
              I-tsek ang 5 dial laban sa litrato bago i-save ang lingguhang konsumo.
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
                Uri ng Analog Meter
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
                Lumipas na Linggo (Missed Weeks Handling)
              </Text>
              <View style={styles.pillToggleRow}>
                {ELAPSED_WEEK_OPTIONS.map((opt) => {
                  const active = selectedDaysElapsed === opt.days;
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
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Interactive 5-Dial / 5-Drum Steppers */}
            <View style={[styles.cardSection, { backgroundColor: theme.cont, borderColor: theme.line }]}>
              <Text style={[styles.sectionTitle, { color: theme.ink, fontSize: 13.5 * fontScale }]}>
                {selectedMeterType === 'cyclometer'
                  ? 'Interactive 5-Drum Cyclometer Pickers'
                  : 'Interactive 5-Dial Pickers'}
              </Text>
              <Text style={[styles.sectionHint, { color: theme.muted, fontSize: 11.5 * fontScale }]}>
                Pindutin ang + o - upang itugma ang bawat dial sa litrato
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
                Kabuuang Reading sa Metro (Cumulative kWh)
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
                    Nakaraang Reading
                  </Text>
                  <Text style={[styles.previewVal, { color: theme.ink, fontSize: 15 * fontScale }]}>
                    {previousReadingKwh.toLocaleString()} kWh
                  </Text>
                </View>

                <View style={styles.previewCol}>
                  <Text style={[styles.previewLabel, { color: theme.muted, fontSize: 11.5 * fontScale }]}>
                    Konsumo Ngayong Linggo
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
                    Tinatayang Halaga
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
                  Mas Mababa ang Reading!
                </Text>
                <Text style={[styles.alertBody, { color: theme.ink, fontSize: 12 * fontScale }]}>
                  Ang kasalukuyang reading ({currentReadingNumber} kWh) ay mas mababa kaysa nakaraan ({previousReadingKwh} kWh). Pakitiyak ang mga dial sa litrato.
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
                  Spike Alert sa Konsumo!
                </Text>
                <Text style={[styles.alertBody, { color: theme.ink, fontSize: 12 * fontScale }]}>
                  Lampas sa 150 kWh ang konsumo para sa isang linggo ({deltaCalc.weeklyUsageKwh} kWh). Siguraduhing tama ang pagbasa sa 10,000s at 1,000s dials.
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
                  5-Dial Rollover Na-detect
                </Text>
                <Text style={[styles.alertBody, { color: theme.ink, fontSize: 12 * fontScale }]}>
                  Lumampas na sa 99,999 pabalik sa 00,000 ang metro. Ang kalkuladong lingguhang konsumo ay {deltaCalc.weeklyUsageKwh} kWh.
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
              accessibilityLabel="Kumuha muli ng litrato"
            >
              <Text style={[styles.retakeBtnText, { color: theme.ink, fontSize: 14 * fontScale }]}>
                Kumuha Muli
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: theme.brand }]}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Kumpirmahin at I-save ang reading"
            >
              <Text style={[styles.confirmBtnText, { color: theme.brandInk, fontSize: 14.5 * fontScale }]}>
                Kumpirmahin at I-save
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
});
