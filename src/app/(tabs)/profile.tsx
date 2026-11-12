import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useEnergy } from '../../context/EnergyContext';
import { TEAM_INFO, MOCK_USER } from '../../constants/mockData';
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, fontScale } = useTheme();
  const { user, logout } = useAuth();
  const {
    budget,
    setBudget,
    activeBill,
    canProfiles,
    activeCanId,
    activeCanProfile,
    switchCanProfile,
    renameCanProfile,
  } = useEnergy();

  const [customBudget, setCustomBudget] = useState(budget.toString());
  const [canDropdownOpen, setCanDropdownOpen] = useState(false);
  const [editingCanId, setEditingCanId] = useState<string | null>(null);
  const [editingNameText, setEditingNameText] = useState('');

  useEffect(() => {
    setCustomBudget(budget.toString());
  }, [budget]);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // non-blocking
    }
  };

  const handleUpdateBudget = (delta: number) => {
    triggerHaptic();
    const next = Math.max(500, budget + delta);
    setBudget(next);
    setCustomBudget(next.toString());
  };

  const handleSaveInputBudget = () => {
    const parsed = parseFloat(customBudget);
    if (!isNaN(parsed) && parsed > 0) {
      triggerHaptic();
      setBudget(parsed);
      Alert.alert('Nai-save', `Na-update ang budget sa ₱${parsed.toLocaleString()}.`);
    } else {
      Alert.alert('Maling Halaga', 'Pakilagay ang tamang halaga ng budget.');
    }
  };

  const handleSelectCan = (id: string) => {
    triggerHaptic();
    switchCanProfile(id);
    setCanDropdownOpen(false);
  };

  const handleStartRename = (id: string, currentName: string) => {
    triggerHaptic();
    setEditingCanId(id);
    setEditingNameText(currentName);
  };

  const handleSaveRename = () => {
    if (!editingCanId || !editingNameText.trim()) return;
    triggerHaptic();
    renameCanProfile(editingCanId, editingNameText.trim());
    setEditingCanId(null);
    setEditingNameText('');
  };

  const handleLogout = () => {
    const perform = async () => {
      triggerHaptic();
      await logout();
      router.replace('/login');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Sigurado ka bang nais mong mag-log out sa KuryenTipid?')) {
        perform();
      }
    } else {
      Alert.alert('Mag-log out', 'Sigurado ka bang nais mong mag-log out sa KuryenTipid?', [
        { text: 'Kanselahin', style: 'cancel' },
        { text: 'Mag-log out', style: 'destructive', onPress: perform },
      ]);
    }
  };

  const currentCan = activeCanProfile || {
    id: 'can-1',
    name: 'Bahay (Pasig)',
    accountNumber: user?.can || activeBill?.customerAccountNumber || MOCK_USER.accountNumber,
    customerName: user?.fullName || MOCK_USER.name,
    serviceAddress: MOCK_USER.serviceAddress,
    ratePerKwh: MOCK_USER.ratePerKwh,
    budget,
    currentKwh: 188,
  };

  // Extract avatar initials
  const initials = currentCan.name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'CAN';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.ink, fontSize: 24 * fontScale }]}>
            Profile at Setting
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HeaderAlertButton from="profile" />
            <HeaderSettingsButton />
          </View>
        </View>

        {/* Customer Account Info Card with Right-side CAN Selector Dropdown */}
        <TouchableOpacity
          style={[styles.accountCard, { backgroundColor: theme.surface, borderColor: theme.line }]}
          onPress={() => setCanDropdownOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`CAN Profile: ${currentCan.name}, ${currentCan.accountNumber}. Pindutin para palitan.`}
        >
          <View style={[styles.avatarCircle, { backgroundColor: theme.brand }]}>
            <Text style={[styles.avatarText, { color: theme.brandInk, fontSize: 16 * fontScale }]}>
              {initials}
            </Text>
          </View>

          <View style={styles.accountDetails}>
            <View style={styles.profileNameRow}>
              <Text style={[styles.accountName, { color: theme.ink, fontSize: 17 * fontScale }]}>
                {currentCan.name}
              </Text>
              <View style={[styles.activeCanBadge, { backgroundColor: theme.okBg, borderColor: theme.ok }]}>
                <Text style={[styles.activeCanBadgeText, { color: theme.ok, fontSize: 10 * fontScale }]}>
                  Aktibo
                </Text>
              </View>
            </View>

            <Text style={[styles.canNumber, { color: theme.brand, fontSize: 13 * fontScale }]}>
              CAN: {currentCan.accountNumber}
            </Text>
            <Text style={[styles.serviceAddress, { color: theme.muted, fontSize: 11 * fontScale }]}>
              {currentCan.serviceAddress}
            </Text>
          </View>

          {/* Dropdown Selector on the Right Side of Profile Card with Small Arrow */}
          <View
            style={[styles.dropdownTriggerBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
          >
            <Text style={[styles.dropdownTriggerText, { color: theme.ink, fontSize: 12 * fontScale }]}>
              Palitan
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 3 }}>
              <Path
                d="M6 9L12 15L18 9"
                stroke={theme.ink}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* Monthly Budget Setting */}
        <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.sectionTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            Buwanang Budget ({currentCan.name})
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.muted, fontSize: 12 * fontScale }]}>
            Itakda ang ceiling para sa alert notifications kapag malapit nang lumagpas.
          </Text>

          <View style={styles.budgetControlRow}>
            <TouchableOpacity
              style={[styles.stepperBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
              onPress={() => handleUpdateBudget(-250)}
              accessibilityRole="button"
              accessibilityLabel="Bawasan ng 250 pesos ang budget"
            >
              <Text style={[styles.stepperText, { color: theme.ink, fontSize: 15 * fontScale }]}>
                - ₱250
              </Text>
            </TouchableOpacity>

            <View style={styles.budgetValueBox}>
              <Text style={[styles.budgetText, { color: theme.ink, fontSize: 24 * fontScale }]}>
                ₱{budget.toLocaleString()}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.stepperBtn, { backgroundColor: theme.brand, borderColor: theme.brand }]}
              onPress={() => handleUpdateBudget(250)}
              accessibilityRole="button"
              accessibilityLabel="Dagdagan ng 250 pesos ang budget"
            >
              <Text style={[styles.stepperText, { color: theme.brandInk, fontSize: 15 * fontScale }]}>
                + ₱250
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.manualBudgetRow}>
            <TextInput
              style={[
                styles.budgetInput,
                {
                  backgroundColor: theme.bg,
                  borderColor: theme.line,
                  color: theme.ink,
                  fontSize: 14 * fontScale,
                },
              ]}
              value={customBudget}
              onChangeText={setCustomBudget}
              keyboardType="numeric"
              placeholder="I-type ang budget"
              placeholderTextColor={theme.muted}
            />
            <TouchableOpacity
              style={[styles.saveBudgetBtn, { backgroundColor: theme.ink }]}
              onPress={handleSaveInputBudget}
            >
              <Text style={[styles.saveBudgetText, { color: theme.surface, fontSize: 13 * fontScale }]}>
                I-save
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Team Attribution Card */}
        <View style={[styles.settingSection, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <Text style={[styles.sectionTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            Team {TEAM_INFO.name}
          </Text>

          <View style={{ gap: 6, marginTop: 8 }}>
            {TEAM_INFO.members.map((member, idx) => (
              <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.brand }} />
                <Text style={{ color: theme.ink, fontWeight: '600', fontSize: 13 * fontScale }}>
                  {member}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Logout Action */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: '#fca5a5', backgroundColor: '#fef2f2' }]}
          onPress={handleLogout}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Mag-log out sa KuryenTipid"
        >
          <Text style={[styles.logoutBtnText, { fontSize: 14 * fontScale }]}>
            🚪 Mag-log out sa Account
          </Text>
          {user ? (
            <Text style={[styles.logoutSubText, { fontSize: 11 * fontScale }]}>
              Naka-login bilang {user.fullName || user.username}
            </Text>
          ) : null}
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Multi-CAN Profiles Dropdown / Modal */}
      <Modal
        visible={canDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCanDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCanDropdownOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoidWrap}
          >
            <Pressable
              style={[
                styles.modalDropdownCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.line,
                  shadowColor: theme.ink,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <View style={[styles.modalHeaderRow, { borderBottomColor: theme.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.ink, fontSize: 17 * fontScale }]}>
                    🏢 Mga CAN Profile
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: theme.muted, fontSize: 11 * fontScale }]}>
                    Pumili ng active account o palitan ang pangalan nito.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCanDropdownOpen(false)}
                  style={[styles.closeModalBtn, { backgroundColor: theme.cont }]}
                  accessibilityLabel="Isara"
                >
                  <Text style={[styles.closeModalBtnText, { color: theme.ink, fontSize: 14 * fontScale }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Rename Input if Editing */}
              {editingCanId ? (
                <View style={[styles.renameBox, { backgroundColor: theme.cont, borderColor: theme.brand }]}>
                  <Text style={[styles.renameLabel, { color: theme.ink, fontSize: 12 * fontScale }]}>
                    Bagong Pangalan para sa CAN:
                  </Text>
                  <View style={styles.renameInputRow}>
                    <TextInput
                      style={[
                        styles.renameInput,
                        {
                          backgroundColor: theme.bg,
                          borderColor: theme.line,
                          color: theme.ink,
                          fontSize: 13 * fontScale,
                        },
                      ]}
                      value={editingNameText}
                      onChangeText={setEditingNameText}
                      placeholder="Hal. Bahay sa probinsya..."
                      placeholderTextColor={theme.muted}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleSaveRename}
                    />
                    <TouchableOpacity
                      style={[styles.renameSaveBtn, { backgroundColor: theme.brand }]}
                      onPress={handleSaveRename}
                    >
                      <Text style={[styles.renameSaveText, { color: theme.brandInk, fontSize: 12 * fontScale }]}>
                        I-save
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.renameCancelBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                      onPress={() => setEditingCanId(null)}
                    >
                      <Text style={[styles.renameCancelText, { color: theme.muted, fontSize: 12 * fontScale }]}>
                        Bawi
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {/* List of 3 Preset CAN Profiles */}
              <View style={styles.canList}>
                {canProfiles.map((p) => {
                  const isActive = p.id === activeCanId;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.canItemCard,
                        {
                          backgroundColor: isActive ? `${theme.brand}12` : theme.bg,
                          borderColor: isActive ? theme.brand : theme.line,
                        },
                      ]}
                      onPress={() => handleSelectCan(p.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.canItemMain}>
                        <View style={styles.canItemHeaderRow}>
                          <Text style={[styles.canItemName, { color: theme.ink, fontSize: 15 * fontScale }]}>
                            {p.name}
                          </Text>
                          {isActive ? (
                            <View style={[styles.activeTag, { backgroundColor: theme.brand }]}>
                              <Text style={[styles.activeTagText, { color: theme.brandInk, fontSize: 10 * fontScale }]}>
                                ✓ Aktibo
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={[styles.canItemNumber, { color: theme.brand, fontSize: 12 * fontScale }]}>
                          CAN: {p.accountNumber}
                        </Text>
                        <Text style={[styles.canItemSub, { color: theme.muted, fontSize: 11 * fontScale }]}>
                          {p.serviceAddress} · ₱{p.ratePerKwh}/kWh
                        </Text>
                      </View>

                      {/* Edit Name Button */}
                      <TouchableOpacity
                        style={[styles.renameTriggerBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleStartRename(p.id, p.name);
                        }}
                        accessibilityLabel={`Palitan ang pangalan ng ${p.name}`}
                      >
                        <Text style={[styles.renameTriggerText, { color: theme.ink, fontSize: 11 * fontScale }]}>
                          ✏️ Edit
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
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
    marginBottom: 12,
  },
  title: { fontWeight: '800' },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 6,
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800' },
  accountDetails: { flex: 1 },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  accountName: { fontWeight: '800' },
  activeCanBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  activeCanBadgeText: { fontWeight: '800' },
  canNumber: { marginTop: 2, fontWeight: '700' },
  serviceAddress: { marginTop: 1, fontWeight: '500' },
  dropdownTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  dropdownTriggerText: {
    fontWeight: '700',
  },
  settingSection: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 6,
  },
  sectionTitle: { fontWeight: '800' },
  sectionSubtitle: { fontWeight: '500', marginTop: 2, marginBottom: 4 },
  budgetControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 10,
  },
  stepperBtn: {
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: { fontWeight: '700' },
  budgetValueBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  budgetText: { fontWeight: '800' },
  manualBudgetRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  budgetInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    fontWeight: '600',
  },
  saveBudgetBtn: {
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBudgetText: { fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  keyboardAvoidWrap: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalDropdownCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  modalTitle: { fontWeight: '800' },
  modalSubtitle: { fontWeight: '500', marginTop: 2 },
  closeModalBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeModalBtnText: { fontWeight: '700' },
  renameBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    marginBottom: 10,
  },
  renameLabel: { fontWeight: '700', marginBottom: 6 },
  renameInputRow: { flexDirection: 'row', gap: 6 },
  renameInput: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontWeight: '600',
  },
  renameSaveBtn: {
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameSaveText: { fontWeight: '700' },
  renameCancelBtn: {
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameCancelText: { fontWeight: '600' },
  logoutBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    gap: 4,
  },
  logoutBtnText: {
    color: '#b91c1c',
    fontWeight: '800',
  },
  logoutSubText: {
    color: '#991b1b',
    fontWeight: '500',
  },
  canList: { gap: 8 },
  canItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
  },
  canItemMain: { flex: 1 },
  canItemHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  canItemName: { fontWeight: '800' },
  activeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activeTagText: { fontWeight: '800' },
  canItemNumber: { fontWeight: '700', marginTop: 2 },
  canItemSub: { fontWeight: '500', marginTop: 1 },
  renameTriggerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameTriggerText: { fontWeight: '600' },
});
