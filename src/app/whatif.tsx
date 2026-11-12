import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { useEnergy } from '../context/EnergyContext';
import { calculateWhatIfSavings } from '../lib/tariffEngine';
import { buildWhatIfExplanationPrompt } from '../lib/geminiService';

export default function WhatIfModal() {
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';
  const { currentKwh, askTipi } = useEnergy();

  const [baseTemp] = useState(20);
  const [targetTemp, setTargetTemp] = useState(24);
  const [baseHours] = useState(8);
  const [targetHours, setTargetHours] = useState(8);
  const [ratedWatts] = useState(1100);

  // Behavioral optimization switches
  const [unplugVampire, setUnplugVampire] = useState(true);
  const [shiftPeakHours, setShiftPeakHours] = useState(true);
  const [fridgeEcoMode, setFridgeEcoMode] = useState(false);

  const simulation = calculateWhatIfSavings({
    currentHouseholdKwh: currentKwh,
    baselineTemp: baseTemp,
    targetTemp: targetTemp,
    baselineHoursPerDay: baseHours,
    reducedHoursPerDay: targetHours,
    ratedWatts: ratedWatts,
    isInverter: true,
  });

  const vampireSavings = unplugVampire ? 95 : 0;
  const peakShiftSavings = shiftPeakHours ? 160 : 0;
  const fridgeSavings = fridgeEcoMode ? 110 : 0;

  const totalPesosSaved = simulation.pesoSavedMonthly + vampireSavings + peakShiftSavings + fridgeSavings;
  const totalKwhSaved = Number(
    (
      simulation.kwhSavedMonthly +
      (unplugVampire ? 8.3 : 0) +
      (shiftPeakHours ? 14.0 : 0) +
      (fridgeEcoMode ? 9.6 : 0)
    ).toFixed(2)
  );

  const handleAdjustTemp = (delta: number) => {
    setTargetTemp((prev) => Math.min(30, Math.max(18, prev + delta)));
  };

  const handleAdjustHours = (delta: number) => {
    setTargetHours((prev) => Math.min(24, Math.max(1, prev + delta)));
  };

  const handleApplyToAgent = () => {
    const prompt = buildWhatIfExplanationPrompt({
      targetTemp,
      targetHours,
      unplugVampire,
      shiftPeakHours,
      fridgeEcoMode,
      totalPesosSaved,
      totalKwhSaved,
      language,
    });
    askTipi(prompt);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header with Close Button */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.ink, fontSize: 22 * fontScale, fontFamily: 'Coolvetica' }]}>
            Watt-<Text style={{ color: '#FF6B00' }}>Calculator</Text>
          </Text>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Isara ang calculator"
          >
            <Text style={[styles.closeBtnText, { color: theme.ink, fontSize: 16 * fontScale }]}>
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        {/* Savings Big Result Card */}
        <View style={[styles.resultCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.resultLabel, { color: theme.muted, fontSize: 12 * fontScale }]}>
            {isEnglish ? 'ESTIMATED MONTHLY SAVINGS' : 'TINATAYANG MATITIPID BAWAT BUWAN'}
          </Text>
          <Text style={[styles.savingsAmount, { color: theme.ok, fontSize: 36 * fontScale }]}>
            ₱{totalPesosSaved.toFixed(2)}
          </Text>
          <Text style={[styles.savingsKwh, { color: theme.ink, fontSize: 14 * fontScale }]}>
            {isEnglish ? (
              <>
                Saves <Text style={{ fontWeight: '800' }}>{totalKwhSaved} kWh</Text> in consumption
              </>
            ) : (
              <>
                Bawas <Text style={{ fontWeight: '800' }}>{totalKwhSaved} kWh</Text> sa konsumo
              </>
            )}
          </Text>

          {simulation.achievedTierDrop && (
            <View style={[styles.tierDropPill, { backgroundColor: theme.okBg }]}>
              <Text style={[styles.tierDropText, { color: theme.ok, fontSize: 12 * fontScale }]}>
                {isEnglish ? 'Drops into a lower distribution tier!' : 'Bababa sa mas murang distribution tier!'}
              </Text>
            </View>
          )}

          <View style={[styles.formulaBox, { backgroundColor: theme.cont }]}>
            <Text style={[styles.formulaText, { color: theme.ink, fontSize: 12 * fontScale }]}>
              Formula: {targetTemp}°C ({targetHours}h/{isEnglish ? 'day' : 'araw'}) + {unplugVampire ? 'standby ' : ''}{shiftPeakHours ? 'off-peak ' : ''}{fridgeEcoMode ? 'fridge ' : ''}savings
            </Text>
          </View>
        </View>

        {/* Aircon Controls */}
        <View style={[styles.controlsCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.cardSectionTitle, { color: theme.ink, fontSize: 15 * fontScale }]}>
            Air Conditioner (1,100 W)
          </Text>

          {/* Temperature */}
          <View style={styles.controlRow}>
            <Text style={[styles.controlName, { color: theme.ink, fontSize: 14 * fontScale }]}>
              Thermostat:
            </Text>

            <View style={styles.stepperGroup}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                onPress={() => handleAdjustTemp(-1)}
              >
                <Text style={[styles.stepBtnText, { color: theme.ink }]}>-</Text>
              </TouchableOpacity>
              <View style={styles.valueDisplay}>
                <Text style={[styles.valueText, { color: theme.brand, fontSize: 18 * fontScale }]}>
                  {targetTemp}°C
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.brand, borderColor: theme.brand }]}
                onPress={() => handleAdjustTemp(1)}
              >
                <Text style={[styles.stepBtnText, { color: theme.brandInk }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Hours */}
          <View style={styles.controlRow}>
            <Text style={[styles.controlName, { color: theme.ink, fontSize: 14 * fontScale }]}>
              {isEnglish ? 'Hours per day:' : 'Oras bawat araw:'}
            </Text>

            <View style={styles.stepperGroup}>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                onPress={() => handleAdjustHours(-1)}
              >
                <Text style={[styles.stepBtnText, { color: theme.ink }]}>-</Text>
              </TouchableOpacity>
              <View style={styles.valueDisplay}>
                <Text style={[styles.valueText, { color: theme.brand, fontSize: 18 * fontScale }]}>
                  {targetHours}h
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.stepBtn, { backgroundColor: theme.brand, borderColor: theme.brand }]}
                onPress={() => handleAdjustHours(1)}
              >
                <Text style={[styles.stepBtnText, { color: theme.brandInk }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Behavioral Household Levers */}
        <View style={[styles.controlsCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.cardSectionTitle, { color: theme.ink, fontSize: 15 * fontScale }]}>
            {isEnglish ? 'Other Ways to Save' : 'Iba pang Paraan ng Pagtitipid'}
          </Text>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelCol}>
              <Text style={[styles.switchTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {isEnglish ? 'Eliminate Standby Loads' : 'Tanggalin ang Standby Loads'}
              </Text>
              <Text style={[styles.switchSub, { color: theme.muted, fontSize: 11 * fontScale }]}>
                {isEnglish ? 'Unplug at night (+₱95/mo)' : 'I-unplug sa gabi (+₱95/mo)'}
              </Text>
            </View>
            <Switch
              value={unplugVampire}
              onValueChange={setUnplugVampire}
              trackColor={{ false: theme.line, true: theme.brand }}
              thumbColor={theme.surface}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelCol}>
              <Text style={[styles.switchTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {isEnglish ? 'Shift to Off-Peak' : 'I-shift sa Off-Peak'}
              </Text>
              <Text style={[styles.switchSub, { color: theme.muted, fontSize: 11 * fontScale }]}>
                {isEnglish ? 'Iron/laundry before 8 AM or after 9 PM (+₱160/mo)' : 'Mag-plantsa/laba bago 8 AM o tapos 9 PM (+₱160/mo)'}
              </Text>
            </View>
            <Switch
              value={shiftPeakHours}
              onValueChange={setShiftPeakHours}
              trackColor={{ false: theme.line, true: theme.brand }}
              thumbColor={theme.surface}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabelCol}>
              <Text style={[styles.switchTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                Refrigerator Eco Mode
              </Text>
              <Text style={[styles.switchSub, { color: theme.muted, fontSize: 11 * fontScale }]}>
                {isEnglish ? 'Medium dial & clean door seal (+₱110/mo)' : 'Katamtamang dial at malinis na pinto (+₱110/mo)'}
              </Text>
            </View>
            <Switch
              value={fridgeEcoMode}
              onValueChange={setFridgeEcoMode}
              trackColor={{ false: theme.line, true: theme.brand }}
              thumbColor={theme.surface}
            />
          </View>
        </View>

        {/* Tip Box */}
        <View style={[styles.tipCard, { backgroundColor: theme.okBg, borderColor: theme.ok }]}>
          <Text style={[styles.tipBody, { color: theme.ink, fontSize: 12 * fontScale }]}>
            {isEnglish
              ? 'Tip: 24°C to 25°C is the DOE standard for balanced comfort and energy savings.'
              : 'Tip: Ang 24°C hanggang 25°C ang DOE standard para sa balanseng ginhawa at tipid.'}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.applyBtn, { backgroundColor: theme.brand }]}
          onPress={handleApplyToAgent}
        >
          <Text style={[styles.applyBtnText, { color: theme.brandInk, fontSize: 15 * fontScale }]}>
            {isEnglish ? 'Apply Settings' : 'I-apply ang Settings'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 10 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { fontWeight: '800' },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontWeight: '700' },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 6,
    alignItems: 'center',
  },
  resultLabel: { fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  savingsAmount: { fontWeight: '800', marginVertical: 2 },
  savingsKwh: { fontWeight: '600' },
  tierDropPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  tierDropText: { fontWeight: '700' },
  formulaBox: {
    width: '100%',
    borderRadius: 10,
    padding: 8,
    marginTop: 8,
  },
  formulaText: { textAlign: 'center', fontWeight: '500' },
  controlsCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 6,
  },
  cardSectionTitle: { fontWeight: '800', marginBottom: 8 },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
    paddingVertical: 4,
  },
  controlName: { fontWeight: '700' },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontWeight: '800', fontSize: 18 },
  valueDisplay: {
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: { fontWeight: '800' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  switchLabelCol: {
    flex: 1,
  },
  switchTitle: {
    fontWeight: '700',
  },
  switchSub: {
    marginTop: 1,
  },
  tipCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    marginVertical: 6,
  },
  tipBody: { lineHeight: 16, fontWeight: '500' },
  applyBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  applyBtnText: { fontWeight: '800' },
});
