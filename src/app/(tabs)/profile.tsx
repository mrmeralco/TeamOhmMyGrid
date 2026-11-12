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
import { MeterClassificationBadge } from '../../components/MeterClassificationBadge';
import { formatCANDisplay } from '../../utils/validation';

export default function ProfileScreen() {
  const router = useRouter();
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';
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
    addCanProfile,
    deleteCanProfile,
  } = useEnergy();

  const [customBudget, setCustomBudget] = useState(budget.toString());
  const [canDropdownOpen, setCanDropdownOpen] = useState(false);
  const [editingCanId, setEditingCanId] = useState<string | null>(null);
  const [editingNameText, setEditingNameText] = useState('');

  const [isAddingCan, setIsAddingCan] = useState(false);
  const [newCanName, setNewCanName] = useState('');
  const [newCanNumber, setNewCanNumber] = useState('');
  const [newCanAddress, setNewCanAddress] = useState('');
  const [addCanError, setAddCanError] = useState('');

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

  const handleSaveNewCan = () => {
    const clean = newCanNumber.replace(/\D/g, '');
    if (clean.length !== 10) {
      setAddCanError('Ang CAN ay dapat eksaktong 10 numero.');
      return;
    }
    triggerHaptic();
    addCanProfile(
      newCanName.trim() || `CAN ${clean.slice(-4)}`,
      clean,
      newCanAddress.trim() || undefined
    );
    setIsAddingCan(false);
    setNewCanName('');
    setNewCanNumber('');
    setNewCanAddress('');
    setAddCanError('');
  };

  const handleDeleteCan = (id: string, name: string) => {
    triggerHaptic();
    Alert.alert(
      'Alisin ang CAN Profile',
      `Sigurado ka bang nais mong alisin ang profile na "${name}"?`,
      [
        { text: 'Kanselahin', style: 'cancel' },
        {
          text: 'Alisin',
          style: 'destructive',
          onPress: () => deleteCanProfile(id),
        },
      ]
    );
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
    id: `can-${user?.can || 'primary'}`,
    name: 'Bahay',
    accountNumber:
      (user?.can ? formatCANDisplay(user.can) : null) ||
      activeBill?.customerAccountNumber ||
      MOCK_USER.accountNumber,
    customerName: user?.fullName || MOCK_USER.name,
    serviceAddress: user?.serviceAddress || MOCK_USER.serviceAddress,
    ratePerKwh: 11.43,
    budget,
    currentKwh: 188,
  };

  const displayName = user?.fullName || currentCan.customerName || 'Customer';

  // Extract avatar initials
  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.ink, fontSize: 28 * fontScale, fontFamily: 'Coolvetica', letterSpacing: 0.8 }]}>
            {isEnglish ? 'Profile & ' : 'Profile at '}<Text style={{ color: '#FF6B00' }}>{isEnglish ? 'Settings' : 'Setting'}</Text>
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
          accessibilityLabel={`CAN Profile: ${currentCan.name}, ${currentCan.accountNumber}. ${isEnglish ? 'Tap to switch.' : 'Pindutin para palitan.'}`}
        >
          <View style={[styles.avatarCircle, { backgroundColor: theme.brand }]}>
            <Text style={[styles.avatarText, { color: theme.brandInk, fontSize: 16 * fontScale }]}>
              {initials}
            </Text>
          </View>

          <View style={styles.accountDetails}>
            <View style={styles.profileNameRow}>
              <Text style={[styles.accountName, { color: theme.ink, fontSize: 17 * fontScale }]}>
                {displayName}
              </Text>
              <View style={[styles.activeCanBadge, { backgroundColor: theme.okBg, borderColor: theme.ok }]}>
                <Text style={[styles.activeCanBadgeText, { color: theme.ok, fontSize: 10 * fontScale }]}>
                  {currentCan.name}
                </Text>
              </View>
            </View>

            <Text style={[styles.canNumber, { color: theme.brand, fontSize: 13 * fontScale }]}>
              CAN: {currentCan.accountNumber}
            </Text>
            <Text style={[styles.serviceAddress, { color: theme.muted, fontSize: 11 * fontScale }]}>
              {currentCan.serviceAddress}
            </Text>
            {user?.email ? (
              <Text style={[styles.serviceAddress, { color: theme.muted, fontSize: 10 * fontScale, marginTop: 1 }]}>
                {user.email}
              </Text>
            ) : null}
          </View>

          {/* Dropdown Selector on the Right Side of Profile Card with Small Arrow */}
          <View
            style={[styles.dropdownTriggerBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
          >
            <Text style={[styles.dropdownTriggerText, { color: theme.ink, fontSize: 12 * fontScale }]}>
              {isEnglish ? 'Switch' : 'Palitan'}
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
            {isEnglish ? `Monthly Budget (${currentCan.name})` : `Buwanang Budget (${currentCan.name})`}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.muted, fontSize: 12 * fontScale }]}>
            {isEnglish
              ? 'Set your monthly ceiling to receive alerts when nearing your budget.'
              : 'Itakda ang ceiling para sa alert notifications kapag malapit nang lumagpas.'}
          </Text>

          <View style={styles.budgetControlRow}>
            <TouchableOpacity
              style={[styles.stepperBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
              onPress={() => handleUpdateBudget(-250)}
              accessibilityRole="button"
              accessibilityLabel={isEnglish ? 'Decrease budget by 250 pesos' : 'Bawasan ng 250 pesos ang budget'}
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
              accessibilityLabel={isEnglish ? 'Increase budget by 250 pesos' : 'Dagdagan ng 250 pesos ang budget'}
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
              placeholder={isEnglish ? 'Enter budget' : 'I-type ang budget'}
              placeholderTextColor={theme.muted}
            />
            <TouchableOpacity
              style={[styles.saveBudgetBtn, { backgroundColor: theme.ink }]}
              onPress={handleSaveInputBudget}
            >
              <Text style={[styles.saveBudgetText, { color: theme.surface, fontSize: 13 * fontScale }]}>
                {isEnglish ? 'Save' : 'I-save'}
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
          accessibilityLabel={isEnglish ? 'Log out of KuryenTipid' : 'Mag-log out sa KuryenTipid'}
        >
          <Text style={[styles.logoutBtnText, { fontSize: 14 * fontScale }]}>
            {isEnglish ? 'Log Out of Account' : 'Mag-log out sa Account'}
          </Text>
          {user ? (
            <Text style={[styles.logoutSubText, { fontSize: 11 * fontScale }]}>
              {isEnglish ? `Signed in as ${user.fullName || user.username}` : `Naka-login bilang ${user.fullName || user.username}`}
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
                    Mga CAN Profile
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

              {/* List of CAN Profiles */}
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
                                Aktibo
                              </Text>
                            </View>
                          ) : null}
                        </View>

                        <Text style={[styles.canItemNumber, { color: theme.brand, fontSize: 12 * fontScale }]}>
                          CAN: {p.accountNumber}
                        </Text>
                        <View style={{ marginTop: 4, marginBottom: 2 }}>
                          <MeterClassificationBadge
                            meterType={p.meterType || 'AMI'}
                            size="compact"
                            showIcon={false}
                            showSubtitle={false}
                          />
                        </View>
                        <Text style={[styles.canItemSub, { color: theme.muted, fontSize: 11 * fontScale }]}>
                          {p.serviceAddress} · ₱{p.ratePerKwh}/kWh
                        </Text>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                            Edit
                          </Text>
                        </TouchableOpacity>

                        {/* Delete secondary CAN button */}
                        {!isActive && canProfiles.length > 1 ? (
                          <TouchableOpacity
                            style={[styles.deleteCanBtn, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleDeleteCan(p.id, p.name);
                            }}
                            accessibilityLabel={`Alisin ang CAN ${p.name}`}
                          >
                            <Text style={[styles.deleteCanText, { fontSize: 11 * fontScale }]}>
                              Alisin
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add New CAN Profile Section */}
              {!isAddingCan ? (
                <TouchableOpacity
                  style={[styles.addCanBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                  onPress={() => {
                    triggerHaptic();
                    setIsAddingCan(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Magdagdag ng Bagong CAN"
                >
                  <Text style={[styles.addCanBtnText, { color: theme.brand, fontSize: 13 * fontScale }]}>
                    + Magdagdag ng Bagong CAN
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.addCanBox, { backgroundColor: theme.cont, borderColor: theme.brand }]}>
                  <Text style={[styles.addCanTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                    Magdagdag ng Bagong Meralco CAN
                  </Text>
                  <TextInput
                    style={[styles.addCanInput, { backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }]}
                    value={newCanName}
                    onChangeText={setNewCanName}
                    placeholder="Pangalan (Hal. Bahay, Tindahan, Condo)"
                    placeholderTextColor={theme.muted}
                  />
                  <TextInput
                    style={[styles.addCanInput, { backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink, marginTop: 6 }]}
                    value={newCanNumber}
                    onChangeText={(t) => {
                      setNewCanNumber(t);
                      setAddCanError('');
                    }}
                    keyboardType="numeric"
                    maxLength={12}
                    placeholder="10-digit CAN (Hal. 1234-5678-90)"
                    placeholderTextColor={theme.muted}
                  />
                  <TextInput
                    style={[styles.addCanInput, { backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink, marginTop: 6 }]}
                    value={newCanAddress}
                    onChangeText={setNewCanAddress}
                    placeholder="Address (Optional)"
                    placeholderTextColor={theme.muted}
                  />
                  {addCanError ? (
                    <Text style={{ color: '#ef4444', fontSize: 11 * fontScale, marginTop: 4 }}>
                      {addCanError}
                    </Text>
                  ) : null}
                  <View style={styles.addCanActionsRow}>
                    <TouchableOpacity
                      style={[styles.addCanSaveBtn, { backgroundColor: theme.brand }]}
                      onPress={handleSaveNewCan}
                    >
                      <Text style={[styles.addCanSaveText, { color: theme.brandInk, fontSize: 12 * fontScale }]}>
                        I-save
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addCanCancelBtn, { backgroundColor: theme.bg, borderColor: theme.line }]}
                      onPress={() => {
                        setIsAddingCan(false);
                        setAddCanError('');
                      }}
                    >
                      <Text style={[styles.addCanCancelText, { color: theme.muted, fontSize: 12 * fontScale }]}>
                        Kanselahin
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
  deleteCanBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCanText: { fontWeight: '600' },
  addCanBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  addCanBtnText: { fontWeight: '700' },
  addCanBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  addCanTitle: { fontWeight: '800', marginBottom: 8 },
  addCanInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  addCanActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  addCanSaveBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCanSaveText: { fontWeight: '700' },
  addCanCancelBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCanCancelText: { fontWeight: '600' },
});
