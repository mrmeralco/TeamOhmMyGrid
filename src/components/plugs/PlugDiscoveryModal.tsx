import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import {
  ApplianceTypeId,
  DiscoveredPlugCandidate,
  SmartPlugDevice,
} from '../../types';
import {
  APPLIANCE_TYPES,
  buildOnboardedPlug,
  generateNearbyPlugCandidates,
  getApplianceCatalogEntry,
} from '../../lib/smartPlugCatalog';
import { ApplianceIcon } from './ApplianceIcon';

interface PlugDiscoveryModalProps {
  visible: boolean;
  existingPlugs: SmartPlugDevice[];
  onClose: () => void;
  onAddPlug: (plug: SmartPlugDevice) => void;
}

const ROOM_PRESETS = [
  'Living Room',
  'Master Bedroom',
  'Kitchen',
  'Laundry Area',
  'Home Office',
];

export const PlugDiscoveryModal: React.FC<PlugDiscoveryModalProps> = ({
  visible,
  existingPlugs,
  onClose,
  onAddPlug,
}) => {
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';

  const [step, setStep] = useState<'scanning' | 'candidates' | 'configure'>('scanning');
  const [candidates, setCandidates] = useState<DiscoveredPlugCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<DiscoveredPlugCandidate | null>(null);
  const [customName, setCustomName] = useState('');
  const [roomLocation, setRoomLocation] = useState('Living Room');
  const [applianceType, setApplianceType] = useState<ApplianceTypeId>('fan');

  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const existingPlugsRef = useRef<SmartPlugDevice[]>(existingPlugs);

  useEffect(() => {
    existingPlugsRef.current = existingPlugs;
  }, [existingPlugs]);

  const clearScanTimer = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  }, []);

  const scheduleDiscovery = useCallback(() => {
    clearScanTimer();
    scanTimerRef.current = setTimeout(() => {
      const found = generateNearbyPlugCandidates(existingPlugsRef.current);
      setCandidates(found);
      setStep('candidates');
    }, 1250);
  }, [clearScanTimer]);

  const startScan = useCallback(() => {
    setStep('scanning');
    setSelectedCandidate(null);
    scheduleDiscovery();
  }, [scheduleDiscovery]);

  const handleClose = useCallback(() => {
    clearScanTimer();
    setStep('scanning');
    setSelectedCandidate(null);
    onClose();
  }, [clearScanTimer, onClose]);

  useEffect(() => {
    if (visible) {
      scheduleDiscovery();
    } else {
      clearScanTimer();
    }
    return () => clearScanTimer();
  }, [visible, scheduleDiscovery, clearScanTimer]);

  const handleSelectCandidate = (candidate: DiscoveredPlugCandidate) => {
    setSelectedCandidate(candidate);
    const defaultType: ApplianceTypeId = 'fan';
    const entry = getApplianceCatalogEntry(defaultType);
    setApplianceType(defaultType);
    setCustomName(entry.defaultName);
    setRoomLocation('Living Room');
    setStep('configure');
  };

  const handleSelectApplianceType = (nextType: ApplianceTypeId) => {
    const prevEntry = getApplianceCatalogEntry(applianceType);
    const nextEntry = getApplianceCatalogEntry(nextType);
    setApplianceType(nextType);
    if (!customName.trim() || customName.trim() === prevEntry.defaultName) {
      setCustomName(nextEntry.defaultName);
    }
  };

  const handleConfirmPair = () => {
    if (!selectedCandidate) return;
    const plug = buildOnboardedPlug({
      candidate: selectedCandidate,
      name: customName,
      location: roomLocation,
      applianceType,
    });
    onAddPlug(plug);
    handleClose();
  };

  const selectedEntry = getApplianceCatalogEntry(applianceType);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.line,
              shadowColor: theme.ink,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View style={[styles.demoBadge, { backgroundColor: '#FF6B0018', borderColor: '#FF6B0040' }]}>
                  <Text style={[styles.demoBadgeText, { color: '#D95200', fontSize: 10 * fontScale }]}>
                    {isEnglish ? 'SIMULATED SCAN (DEMO)' : 'SIMULATED SCAN (DEMO)'}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.title,
                  { color: theme.ink, fontSize: 19 * fontScale, fontFamily: 'Coolvetica' },
                ]}
              >
                {step === 'configure'
                  ? isEnglish
                    ? 'Configure Smart Plug'
                    : 'I-configure ang Smart Plug'
                  : isEnglish
                    ? 'Detect Nearby Smart Plugs'
                    : 'Maghanap ng Kalapit na Smart Plug'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
              accessibilityRole="button"
              accessibilityLabel={isEnglish ? 'Close discovery modal' : 'Isara'}
            >
              <Text style={[styles.closeBtnText, { color: theme.ink, fontSize: 14 * fontScale }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {step === 'scanning' ? (
            <View style={styles.scanningBox}>
              <View style={[styles.radarRing, { borderColor: '#FF6B0044', backgroundColor: '#FF6B000D' }]}>
                <ActivityIndicator size="large" color="#FF5500" />
              </View>
              <Text style={[styles.scanHeading, { color: theme.ink, fontSize: 15 * fontScale }]}>
                {isEnglish
                  ? 'Scanning nearby BLE & Wi-Fi smart plugs...'
                  : 'Naghahanap ng kalapit na BLE at Wi-Fi smart plugs...'}
              </Text>
              <Text style={[styles.scanSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                {isEnglish
                  ? 'Make sure your smart plug indicator light is blinking.'
                  : 'Siguraduhing kumukurap ang ilaw ng iyong smart plug.'}
              </Text>
            </View>
          ) : null}

          {step === 'candidates' ? (
            <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionHint, { color: theme.muted, fontSize: 12 * fontScale }]}>
                {isEnglish
                  ? `Found ${candidates.length} nearby devices ready to pair. Select one to set up:`
                  : `Nakakita ng ${candidates.length} kalapit na device. Pumili ng isa para i-setup:`}
              </Text>

              {candidates.map((cand) => {
                const signalColor =
                  cand.signalLabel === 'Strong'
                    ? '#10B981'
                    : cand.signalLabel === 'Good'
                      ? '#D97706'
                      : theme.muted;

                return (
                  <TouchableOpacity
                    key={cand.id}
                    style={[
                      styles.candidateCard,
                      { backgroundColor: theme.cont, borderColor: theme.line },
                    ]}
                    onPress={() => handleSelectCandidate(cand)}
                    accessibilityRole="button"
                  >
                    <View style={[styles.candIconBox, { backgroundColor: '#FF6B0018' }]}>
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Circle cx="12" cy="12" r="9" stroke="#FF5500" strokeWidth="2" />
                        <Path d="M9 12H15M12 9V15" stroke="#FF5500" strokeWidth="2" strokeLinecap="round" />
                      </Svg>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.candModel, { color: theme.ink, fontSize: 14 * fontScale }]}>
                        {cand.model}
                      </Text>
                      <Text style={[styles.candMeta, { color: theme.muted, fontSize: 11 * fontScale }]}>
                        {cand.deviceId} · {cand.macAddress}
                      </Text>
                    </View>

                    <View style={[styles.signalBadge, { borderColor: signalColor }]}>
                      <Text style={[styles.signalText, { color: signalColor, fontSize: 10 * fontScale }]}>
                        {cand.signalLabel} · {cand.rssiDbm} dBm
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.rescanBtn, { borderColor: theme.line, backgroundColor: theme.cont }]}
                onPress={startScan}
                accessibilityRole="button"
              >
                <Text style={[styles.rescanBtnText, { color: theme.brand, fontSize: 13 * fontScale }]}>
                  {isEnglish ? 'Scan Again' : 'Mag-scan Ulit'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          ) : null}

          {step === 'configure' && selectedCandidate ? (
            <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.selectedHardwareBanner, { backgroundColor: theme.cont, borderColor: theme.line }]}>
                <Text style={[styles.candModel, { color: theme.ink, fontSize: 13 * fontScale }]}>
                  {selectedCandidate.model} ({selectedCandidate.deviceId})
                </Text>
                <TouchableOpacity onPress={() => setStep('candidates')}>
                  <Text style={{ color: theme.brand, fontSize: 12 * fontScale, fontWeight: '700' }}>
                    {isEnglish ? 'Change' : 'Palitan'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {isEnglish ? 'Plug Name' : 'Pangalan ng Smart Plug'}
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  { color: theme.ink, backgroundColor: theme.cont, borderColor: theme.line, fontSize: 14 * fontScale },
                ]}
                value={customName}
                onChangeText={setCustomName}
                placeholder={isEnglish ? 'e.g. Bedroom Aircon' : 'hal. Aircon sa Kwarto'}
                placeholderTextColor={theme.muted}
                maxLength={36}
              />

              <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {isEnglish ? 'Room / Location' : 'Kwarto / Lokasyon'}
              </Text>
              <View style={styles.chipsWrap}>
                {ROOM_PRESETS.map((room) => {
                  const selected = roomLocation === room;
                  return (
                    <TouchableOpacity
                      key={room}
                      style={[
                        styles.roomChip,
                        {
                          backgroundColor: selected ? theme.brand : theme.cont,
                          borderColor: selected ? theme.brand : theme.line,
                        },
                      ]}
                      onPress={() => setRoomLocation(room)}
                    >
                      <Text
                        style={{
                          color: selected ? '#FFFFFF' : theme.ink,
                          fontSize: 11 * fontScale,
                          fontWeight: '600',
                        }}
                      >
                        {room}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  { color: theme.ink, backgroundColor: theme.cont, borderColor: theme.line, fontSize: 14 * fontScale },
                ]}
                value={roomLocation}
                onChangeText={setRoomLocation}
                placeholder={isEnglish ? 'Custom room name' : 'Ibang lokasyon'}
                placeholderTextColor={theme.muted}
                maxLength={32}
              />

              <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 * fontScale }]}>
                {isEnglish ? 'Appliance Type' : 'Uri ng Appliance'}
              </Text>
              <View style={styles.applianceGrid}>
                {APPLIANCE_TYPES.map((entry) => {
                  const isSelected = applianceType === entry.id;
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={[
                        styles.applianceCell,
                        {
                          backgroundColor: isSelected ? `${entry.color}18` : theme.cont,
                          borderColor: isSelected ? entry.color : theme.line,
                        },
                      ]}
                      onPress={() => handleSelectApplianceType(entry.id)}
                    >
                      <ApplianceIcon
                        iconId={entry.id}
                        color={isSelected ? entry.color : theme.muted}
                        size={20}
                      />
                      <Text
                        style={[
                          styles.applianceCellLabel,
                          { color: theme.ink, fontSize: 11 * fontScale },
                        ]}
                        numberOfLines={1}
                      >
                        {isEnglish ? entry.labelEn : entry.labelTl}
                      </Text>
                      <Text style={[styles.applianceWatts, { color: theme.muted, fontSize: 10 * fontScale }]}>
                        {entry.nominalWatts}W
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.previewStrip, { backgroundColor: `${selectedEntry.color}12`, borderColor: `${selectedEntry.color}40` }]}>
                <ApplianceIcon iconId={selectedEntry.id} color={selectedEntry.color} size={20} />
                <Text style={[styles.previewText, { color: theme.ink, fontSize: 12 * fontScale }]}>
                  {isEnglish
                    ? `Rated load: ${selectedEntry.nominalWatts} W · Starts OFF (0.0 kWh)`
                    : `Rated load: ${selectedEntry.nominalWatts} W · Magsisimulang naka-OFF (0.0 kWh)`}
                </Text>
              </View>

              <View style={styles.footerBtns}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.line, backgroundColor: theme.cont }]}
                  onPress={onClose}
                >
                  <Text style={{ color: theme.ink, fontWeight: '600', fontSize: 14 * fontScale }}>
                    {isEnglish ? 'Cancel' : 'Kanselahin'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: '#FF5500' }]}
                  onPress={handleConfirmPair}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 * fontScale }}>
                    {isEnglish ? 'Pair & Add Plug' : 'I-pair at Idagdag'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 20,
    maxHeight: '88%',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  demoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  demoBadgeText: {
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  closeBtnText: {
    fontWeight: '700',
  },
  scanningBox: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  radarRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  scanHeading: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  scanSub: {
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  bodyScroll: {
    maxHeight: 520,
  },
  sectionHint: {
    marginBottom: 12,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  candIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candModel: {
    fontWeight: '700',
  },
  candMeta: {
    marginTop: 2,
  },
  signalBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  signalText: {
    fontWeight: '700',
  },
  rescanBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  rescanBtnText: {
    fontWeight: '700',
  },
  selectedHardwareBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  fieldLabel: {
    fontWeight: '700',
    marginBottom: 6,
    marginTop: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  roomChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  applianceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  applianceCell: {
    width: '23%',
    minWidth: 72,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 4,
  },
  applianceCellLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
  applianceWatts: {
    fontWeight: '500',
  },
  previewStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  previewText: {
    flex: 1,
    fontWeight: '600',
  },
  footerBtns: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  confirmBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
});
