import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { PageTransitionView } from '../components/PageTransitionView';
import { useAuth } from '../context/AuthContext';
import { useEnergy } from '../context/EnergyContext';

const BUDGET_PRESETS = [2000, 3500, 5000, 7500];

export default function BudgetSetupScreen() {
  const router = useRouter();
  const { user, completeBudgetSetup } = useAuth();
  const { setBudget } = useEnergy();

  const initialBudget = user?.monthlyBudget && user.monthlyBudget > 0 ? user.monthlyBudget : 3500;
  const [budgetInput, setBudgetInput] = useState<string>(String(initialBudget));
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // non-blocking
    }
  };

  const parsedBudget = Number(budgetInput.replace(/,/g, '').trim());
  const isValidBudget = Number.isFinite(parsedBudget) && parsedBudget > 0;

  const handleSelectPreset = (amount: number) => {
    if (busy) return;
    triggerHaptic();
    setBudgetInput(String(amount));
    setError('');
  };

  const handleStep = (delta: number) => {
    if (busy) return;
    triggerHaptic();
    const base = isValidBudget ? parsedBudget : initialBudget;
    const next = Math.max(500, Math.round(base + delta));
    setBudgetInput(String(next));
    setError('');
  };

  const handleContinue = async () => {
    if (busy) return;
    if (!isValidBudget) {
      setError('Please enter a valid monthly budget greater than ₱0.');
      return;
    }

    const finalBudget = Math.round(parsedBudget);
    setBusy(true);
    setError('');
    try {
      triggerHaptic();
      setBudget(finalBudget);
      await completeBudgetSetup(finalBudget);
      router.replace('/(tabs)');
    } catch {
      setError('Unable to save your budget. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <PageTransitionView style={{ flex: 1, width: '100%' }}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.brand}>
              Kuryen<Text style={{ color: '#FF4D26' }}>Tipid</Text>
            </Text>
            <Text style={styles.step}>ONE LAST STEP</Text>
            <Text style={styles.title}>Set your monthly budget</Text>
            <Text style={styles.subtitle}>
              Before heading to your dashboard, tell us your target monthly electricity budget so we can track your Meralco usage and alert you early.
            </Text>

            {!!error && (
              <View style={styles.banner}>
                <Text accessibilityRole="alert" style={styles.bannerText}>
                  {error}
                </Text>
              </View>
            )}

            <Text style={styles.label}>Monthly Electricity Budget (PHP)</Text>
            <View style={[styles.inputRow, !!error && styles.inputError]}>
              <Text style={styles.currencyPrefix}>₱</Text>
              <TextInput
                accessibilityLabel="Monthly electricity budget"
                style={styles.input}
                value={budgetInput}
                onChangeText={(text) => {
                  setBudgetInput(text.replace(/[^0-9.]/g, ''));
                  setError('');
                }}
                keyboardType="numeric"
                placeholder="3500"
                placeholderTextColor="#94a3b8"
                editable={!busy}
                onSubmitEditing={handleContinue}
              />
            </View>

            <View style={styles.stepperRow}>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.stepperBtn}
                onPress={() => handleStep(-500)}
                disabled={busy}
                activeOpacity={0.75}
              >
                <Text style={styles.stepperBtnText}>− ₱500</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.stepperBtn}
                onPress={() => handleStep(500)}
                disabled={busy}
                activeOpacity={0.75}
              >
                <Text style={styles.stepperBtnText}>+ ₱500</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.presetLabel}>Quick presets</Text>
            <View style={styles.presetsGrid}>
              {BUDGET_PRESETS.map((preset) => {
                const selected = isValidBudget && Math.round(parsedBudget) === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    accessibilityRole="button"
                    style={[styles.presetChip, selected && styles.presetChipActive]}
                    onPress={() => handleSelectPreset(preset)}
                    disabled={busy}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetChipText, selected && styles.presetChipTextActive]}>
                      ₱{preset.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.helper}>You can adjust this anytime in your Profile settings.</Text>

            <TouchableOpacity
              accessibilityRole="button"
              style={[styles.button, (busy || !isValidBudget) && styles.disabled]}
              disabled={busy || !isValidBudget}
              onPress={handleContinue}
              activeOpacity={0.88}
            >
              {!(busy || !isValidBudget) && (
                <LinearGradient
                  colors={['#FF4D26', '#FF6B00']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                />
              )}
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save & Go to Homepage</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </PageTransitionView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', backgroundColor: '#faf2ec' },
  scroll: { flex: 1, width: '100%' },
  content: { flexGrow: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: '#f1e8df',
  },
  brand: { color: '#FF6B00', fontSize: 17, fontWeight: '400', fontFamily: 'Coolvetica', marginBottom: 24 },
  step: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, fontFamily: 'Coolvetica' },
  title: { color: '#0f172a', fontSize: 27, fontWeight: '400', fontFamily: 'Coolvetica', marginBottom: 8 },
  subtitle: { color: '#64748b', fontSize: 14, lineHeight: 21, marginBottom: 22 },
  banner: {
    padding: 13,
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 18,
  },
  bannerText: { color: '#9a3412', fontSize: 13, lineHeight: 19 },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 8, fontFamily: 'Coolvetica' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputError: { borderColor: '#dc2626' },
  currencyPrefix: { fontSize: 20, fontWeight: '700', color: '#FF6B00', marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    paddingVertical: 10,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 18,
  },
  stepperBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
  },
  stepperBtnText: { color: '#c2410c', fontSize: 13, fontWeight: '700' },
  presetLabel: { color: '#64748b', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#FF6B00',
  },
  presetChipText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  presetChipTextActive: { color: '#FF4D26', fontWeight: '700' },
  helper: { color: '#64748b', fontSize: 12, lineHeight: 18 },
  button: {
    minHeight: 50,
    backgroundColor: 'transparent',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    overflow: 'hidden',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '400', fontFamily: 'Coolvetica' },
  disabled: { backgroundColor: '#cbd5e1', overflow: 'hidden' },
});
