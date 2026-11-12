import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useEnergy } from '../../context/EnergyContext';
import { SmartPlugDevice, SmartPlugSchedule } from '../../types';
import { isScheduleActiveNow } from '../../lib/smartPlugSimulator';
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { PageTransitionView } from '../../components/PageTransitionView';

// Appliance SVG Icons
const ApplianceIcon: React.FC<{ iconId: string; color: string; size?: number }> = ({
  iconId,
  color,
  size = 24,
}) => {
  switch (iconId) {
    case 'aircon':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="2" y="6" width="20" height="11" rx="2.5" stroke={color} strokeWidth="2" />
          <Path d="M6 13H18M7 17L5 20M17 17L19 20" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <Circle cx="18" cy="9.5" r="1" fill={color} />
        </Svg>
      );
    case 'fridge':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="5" y="2" width="14" height="20" rx="2.5" stroke={color} strokeWidth="2" />
          <Path d="M5 9H19M8 5V7M8 13V16" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );
    case 'fan':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
          <Circle cx="12" cy="12" r="2.5" fill={color} />
          <Path
            d="M12 9.5C12 7.5 13.5 6 15 6C15 8 13.5 9.5 12 9.5ZM14.5 12C16.5 12 18 13.5 18 15C16 15 14.5 13.5 14.5 12ZM12 14.5C12 16.5 10.5 18 9 18C9 16 10.5 14.5 12 14.5ZM9.5 12C7.5 12 6 10.5 6 9C8 9 9.5 10.5 9.5 12Z"
            fill={color}
          />
        </Svg>
      );
    case 'washer':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="2" width="16" height="20" rx="2.5" stroke={color} strokeWidth="2" />
          <Circle cx="12" cy="13" r="5" stroke={color} strokeWidth="2" />
          <Circle cx="8" cy="6" r="1.2" fill={color} />
          <Circle cx="12" cy="6" r="1.2" fill={color} />
          <Path d="M10 13C10 11.8954 10.8954 11 12 11" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        </Svg>
      );
    case 'ricecooker':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 10H19V17C19 19.2091 17.2091 21 15 21H9C6.79086 21 5 19.2091 5 17V10Z"
            stroke={color}
            strokeWidth="2"
          />
          <Path d="M4 10C4 6.5 7.5 5 12 5C16.5 5 20 6.5 20 10" stroke={color} strokeWidth="2" />
          <Path d="M10 3H14" stroke={color} strokeWidth="2" strokeLinecap="round" />
          <Circle cx="12" cy="15" r="1.5" fill={color} />
        </Svg>
      );
    case 'microwave':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="2" y="5" width="20" height="14" rx="2.5" stroke={color} strokeWidth="2" />
          <Rect x="5" y="8" width="10" height="8" rx="1.5" stroke={color} strokeWidth="1.8" />
          <Path d="M18 9V11M18 14V16" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );
    case 'pc':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3" y="3" width="18" height="12" rx="2" stroke={color} strokeWidth="2" />
          <Path d="M8 19H16M12 15V19" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
          <Path d="M12 8V12L15 15" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
      );
  }
};

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function SmartPlugsScreen() {
  const { theme, fontScale } = useTheme();
  const {
    smartPlugs,
    totalActiveWatts,
    isPlugConnected,
    toggleSmartPlug,
    setPlugRelay,
    setAllPlugsRelay,
    setPlugTimer,
    cancelPlugTimer,
    setPlugSchedule,
  } = useEnergy();

  // Filter state
  const [activeFilter, setActiveFilter] = useState<'all' | 'on' | 'off' | 'timer' | 'schedule'>('all');

  // Expanded Plug Cards State (minimized by default)
  const [expandedPlugs, setExpandedPlugs] = useState<Record<string, boolean>>({});

  // Custom Timer Modal State
  const [timerModalPlugId, setTimerModalPlugId] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState('45');

  // Schedule Modal / Editor State
  const [scheduleModalPlug, setScheduleModalPlug] = useState<SmartPlugDevice | null>(null);
  const [schedStartTime, setSchedStartTime] = useState('22:00');
  const [schedEndTime, setSchedEndTime] = useState('06:00');
  const [schedDays, setSchedDays] = useState<string[]>(ALL_DAYS);
  const [schedLabel, setSchedLabel] = useState('Night Sleep Saver');

  // Filtered devices
  const filteredPlugs = smartPlugs.filter((p) => {
    if (activeFilter === 'on') return p.relayState === 'ON';
    if (activeFilter === 'off') return p.relayState === 'OFF';
    if (activeFilter === 'timer') return !!p.timer?.active;
    if (activeFilter === 'schedule') return !!p.schedule?.enabled;
    return true;
  });

  const activeCount = smartPlugs.filter((p) => p.relayState === 'ON').length;
  const totalKwh = Number(smartPlugs.reduce((acc, p) => acc + p.accumulatedKwh, 0).toFixed(1));
  const totalCost = Number(smartPlugs.reduce((acc, p) => acc + p.monthlyCost, 0).toFixed(2));
  const avgVoltage = smartPlugs.length > 0
    ? (smartPlugs.reduce((acc, p) => acc + p.voltageRms, 0) / smartPlugs.length).toFixed(1)
    : '230.0';

  // Trigger tactile haptics
  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }
  };

  const togglePlugExpand = (id: string) => {
    triggerHaptic();
    setExpandedPlugs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleToggle = (id: string) => {
    triggerHaptic();
    toggleSmartPlug(id);
  };

  const handleSetQuickTimer = (plugId: string, minutes: number) => {
    triggerHaptic();
    setPlugTimer(plugId, minutes * 60, 'OFF');
    Alert.alert(
      'Timer Naka-set',
      `Kusang mamamatay ang saksakan pagkalipas ng ${minutes >= 60 ? `${minutes / 60} oras` : `${minutes} minuto`}.`
    );
  };

  const handleOpenCustomTimer = (plugId: string) => {
    setTimerModalPlugId(plugId);
  };

  const handleSaveCustomTimer = () => {
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 1440) {
      Alert.alert('Maling Oras', 'Pakilagay ang bilang ng minuto mula 1 hanggang 1,440 (24 oras).');
      return;
    }
    if (timerModalPlugId) {
      triggerHaptic();
      setPlugTimer(timerModalPlugId, mins * 60, 'OFF');
      setTimerModalPlugId(null);
      Alert.alert(
        'Timer Naka-set',
        `Kusang mamamatay ang saksakan pagkalipas ng ${mins >= 60 ? `${Math.floor(mins / 60)} oras ${mins % 60 ? `${mins % 60}m` : ''}` : `${mins} minuto`}.`
      );
    }
  };

  const handleOpenSchedule = (plug: SmartPlugDevice) => {
    setScheduleModalPlug(plug);
    setSchedStartTime(plug.schedule?.startTime || '22:00');
    setSchedEndTime(plug.schedule?.endTime || '06:00');
    setSchedDays(plug.schedule?.days || ALL_DAYS);
    setSchedLabel(plug.schedule?.label || 'Iwasan ang Peak Hours');
  };

  const handleToggleDay = (day: string) => {
    if (schedDays.includes(day)) {
      if (schedDays.length > 1) {
        setSchedDays(schedDays.filter((d) => d !== day));
      }
    } else {
      setSchedDays([...schedDays, day]);
    }
  };

  const handleSaveSchedule = () => {
    if (!scheduleModalPlug) return;
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(schedStartTime.trim()) || !timeRegex.test(schedEndTime.trim())) {
      Alert.alert(
        'Maling Format ng Oras',
        'Pakilagay ang tamang 24-oras na format ng oras (hal. 22:00 o 06:30).'
      );
      return;
    }
    if (schedDays.length === 0) {
      Alert.alert('Pumili ng Araw', 'Pumili ng kahit isang araw para sa iskedyul.');
      return;
    }
    triggerHaptic();
    const newSchedule: SmartPlugSchedule = {
      enabled: true,
      startTime: schedStartTime.trim(),
      endTime: schedEndTime.trim(),
      days: schedDays,
      label: schedLabel.trim() || 'Custom Schedule',
    };
    setPlugSchedule(scheduleModalPlug.id, newSchedule);
    setScheduleModalPlug(null);
    Alert.alert(
      'Iskedyul Na-save',
      `Aktibo ang iskedyul: ${newSchedule.startTime} – ${newSchedule.endTime} (${schedDays.length === 7 ? 'Araw-araw' : schedDays.join(', ')}).`
    );
  };

  const handleMasterTurnAll = (relay: 'ON' | 'OFF') => {
    triggerHaptic();
    setAllPlugsRelay(relay);
  };

  const formatTimerRemaining = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <PageTransitionView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Top Header */}
          <View style={styles.topHeader}>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.title, { color: theme.ink, fontSize: 24 * fontScale, fontFamily: 'Coolvetica' }]}>
                Mga Smart <Text style={{ color: '#FF6B00' }}>Plug</Text>
              </Text>
              <Text style={[styles.subTitle, { color: theme.muted, fontSize: 13 * fontScale, fontFamily: 'Coolvetica' }]}>
                Live IoT Telemetry & Relay Control
              </Text>
            </View>

            <View style={styles.headerRightGroup}>
              <View
                style={[
                  styles.liveSimBadge,
                  {
                    backgroundColor: isPlugConnected ? theme.okBg : '#FF6B0014',
                    borderColor: isPlugConnected ? theme.ok : '#FF6B0033',
                  },
                ]}
              >
                <View
                  style={[
                    styles.liveDot,
                    { backgroundColor: isPlugConnected ? theme.ok : '#FF5500' },
                  ]}
                />
                <Text
                  style={[
                    styles.liveSimText,
                    { color: isPlugConnected ? theme.ok : '#D95200', fontSize: 10 * fontScale, fontFamily: 'Coolvetica' },
                  ]}
                >
                  {isPlugConnected ? 'HARDWARE' : 'SIMULATOR'}
                </Text>
              </View>

              <HeaderAlertButton from="plugs" />
              <HeaderSettingsButton />
            </View>
          </View>

        {/* Master Telemetry Hero Card */}
        <View
          style={[
            styles.masterHeroCard,
            {
              backgroundColor: theme.surface,
              borderColor: '#FF6B0030',
              shadowColor: '#FF6B00',
            },
          ]}
        >
          <LinearGradient
            colors={['#FF6B000C', '#FFA04014']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
          />
          <View style={styles.masterTopRow}>
            <View>
              <View style={styles.masterWattsRow}>
                <Text style={[styles.masterWattsValue, { color: '#FF4D26', fontSize: 34 * fontScale, fontFamily: 'Coolvetica' }]}>
                  {totalActiveWatts.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                </Text>
                <Text style={[styles.masterWattsUnit, { color: '#FF6B00', fontSize: 18 * fontScale, fontFamily: 'Coolvetica' }]}>
                  W
                </Text>
              </View>
              <Text style={[styles.masterSubtext, { color: theme.muted, fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                Kabuuang konsumo ng mga saksakan
              </Text>
            </View>

            <View style={styles.masterRightPillGroup}>
              <View
                style={[
                  styles.activeCountBadge,
                  {
                    backgroundColor: activeCount > 0 ? '#10B9811A' : theme.cont,
                    borderColor: activeCount > 0 ? '#10B981' : theme.line,
                  },
                ]}
              >
                <View style={styles.liveActiveIndicator}>
                  <View
                    style={[
                      styles.activeDotBeacon,
                      { backgroundColor: activeCount > 0 ? '#10B981' : theme.muted },
                    ]}
                  />
                  <Text
                    style={[
                      styles.activeCountText,
                      {
                        color: activeCount > 0 ? '#10B981' : theme.muted,
                        fontSize: 12 * fontScale,
                        fontFamily: 'Coolvetica',
                      },
                    ]}
                  >
                    {activeCount} ng {smartPlugs.length} Bukás
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Aggregate Stats Row */}
          <View style={[styles.masterStatsRow, { borderTopColor: '#FF6B0018' }]}>
            <View style={styles.masterStatCol}>
              <Text style={[styles.statValue, { color: theme.ink, fontSize: 16 * fontScale, fontFamily: 'Coolvetica' }]}>
                {totalKwh} kWh
              </Text>
              <Text style={[styles.statLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                Naiipong Enerhiya
              </Text>
            </View>

            <View style={[styles.masterDivider, { backgroundColor: '#FF6B0024' }]} />

            <View style={styles.masterStatCol}>
              <Text style={[styles.statValue, { color: '#FF6B00', fontSize: 16 * fontScale, fontFamily: 'Coolvetica' }]}>
                ₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.statLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                Halaga sa Buwan
              </Text>
            </View>

            <View style={[styles.masterDivider, { backgroundColor: '#FF6B0024' }]} />

            <View style={styles.masterStatCol}>
              <Text style={[styles.statValue, { color: '#10B981', fontSize: 16 * fontScale, fontFamily: 'Coolvetica' }]}>
                {avgVoltage} V
              </Text>
              <Text style={[styles.statLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                Grid Voltage RMS
              </Text>
            </View>
          </View>

          {/* Quick Master Actions */}
          <View style={styles.masterActionsRow}>
            <TouchableOpacity
              style={[
                styles.masterBtn,
                { backgroundColor: theme.surface, borderColor: '#FF6B0033' },
              ]}
              onPress={() => handleMasterTurnAll('OFF')}
              accessibilityRole="button"
              accessibilityLabel="Patayin ang lahat ng smart plug"
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                <Rect x="4" y="4" width="16" height="16" rx="3" stroke={theme.ink} strokeWidth="2.5" />
              </Svg>
              <Text style={[styles.masterBtnText, { color: theme.ink, fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                I-OFF Lahat
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.masterBtn,
                { backgroundColor: '#FF5500', borderColor: '#FF5500' },
              ]}
              onPress={() => handleMasterTurnAll('ON')}
              accessibilityRole="button"
              accessibilityLabel="Buksan ang lahat ng smart plug"
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6 }}>
                <Path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#ffffff" />
              </Svg>
              <Text style={[styles.masterBtnText, { color: '#ffffff', fontSize: 12 * fontScale, fontFamily: 'Coolvetica' }]}>
                I-ON Lahat
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[
            { key: 'all', label: `Lahat (${smartPlugs.length})` },
            { key: 'on', label: `Naka-ON (${activeCount})` },
            { key: 'off', label: `Naka-OFF (${smartPlugs.length - activeCount})` },
            { key: 'timer', label: `May Timer (${smartPlugs.filter((p) => p.timer?.active).length})` },
            { key: 'schedule', label: `Naka-Schedule (${smartPlugs.filter((p) => p.schedule?.enabled).length})` },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterPill,
                {
                  backgroundColor: activeFilter === f.key ? '#FF5500' : theme.surface,
                  borderColor: activeFilter === f.key ? '#FF5500' : '#FF6B002B',
                },
              ]}
              onPress={() => setActiveFilter(f.key as any)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  {
                    color: activeFilter === f.key ? '#ffffff' : theme.ink,
                    fontSize: 12 * fontScale,
                    fontFamily: 'Coolvetica',
                  },
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Plug Cards List */}
        <View style={styles.plugsList}>
          {filteredPlugs.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="9" stroke={theme.muted} strokeWidth="2" />
                <Path d="M8 12H16" stroke={theme.muted} strokeWidth="2" strokeLinecap="round" />
              </Svg>
              <Text style={[styles.emptyTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
                Walang Smart Plug sa Filter
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.muted, fontSize: 13 * fontScale }]}>
                Walang saksakan na tumutugma sa kasalukuyang piniling kategorya.
              </Text>
              <TouchableOpacity
                style={[styles.resetFilterBtn, { backgroundColor: theme.cont, borderColor: theme.line }]}
                onPress={() => setActiveFilter('all')}
              >
                <Text style={[styles.resetFilterBtnText, { color: theme.brand, fontSize: 13 * fontScale }]}>
                  Ipakita ang Lahat
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredPlugs.map((plug) => {
              const isPlugOn = plug.relayState === 'ON';
              const isTimerActive = !!plug.timer?.active;
              const isScheduleEnabled = !!plug.schedule?.enabled;
              const isScheduleRunningNow = isScheduleActiveNow(plug.schedule);
              const isExpanded = !!expandedPlugs[plug.id];

              return (
                <View
                  key={plug.id}
                  style={[
                    styles.plugCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isPlugOn ? theme.brand : theme.line,
                      shadowColor: theme.ink,
                    },
                  ]}
                >
                  {/* Minimized Plug Card Row: Essential info + arrow */}
                  <TouchableOpacity
                    style={[styles.cardHeader, { marginBottom: isExpanded ? 12 : 0 }]}
                    onPress={() => togglePlugExpand(plug.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${plug.name}, ${isPlugOn ? 'Naka-ON' : 'Naka-OFF'}, ${plug.powerWatts.toFixed(0)} Watts. ${isExpanded ? 'I-minimize' : 'I-expand'}`}
                  >
                    <View style={styles.cardInfoLeft}>
                      <View
                        style={[
                          styles.iconBadge,
                          {
                            backgroundColor: `${plug.color}15`,
                            borderColor: `${plug.color}40`,
                          },
                        ]}
                      >
                        <ApplianceIcon iconId={plug.iconId} color={plug.color} size={24} />
                      </View>

                      <View style={styles.nameLocationWrap}>
                        <Text style={[styles.plugTitle, { color: theme.ink, fontSize: 15 * fontScale }]} numberOfLines={1}>
                          {plug.name}
                        </Text>
                        <Text style={[styles.plugSubtitle, { color: theme.muted, fontSize: 11 * fontScale }]} numberOfLines={1}>
                          {plug.location} · <Text style={{ color: isPlugOn ? theme.ok : theme.muted, fontWeight: '700' }}>{isPlugOn ? 'ON' : 'OFF'}</Text>
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardHeaderRight}>
                      {/* Live Watts */}
                      <View style={[styles.liveWattsPill, { backgroundColor: theme.cont }]}>
                        <Text style={[styles.liveWattsPillText, { color: isPlugOn ? theme.brand : theme.muted, fontSize: 12 * fontScale }]}>
                          {plug.powerWatts.toFixed(0)} W
                        </Text>
                      </View>

                      {/* Dedicated Tactile ON/OFF Button */}
                      <TouchableOpacity
                        style={[
                          styles.dedicatedToggleBtn,
                          {
                            backgroundColor: isPlugOn ? theme.ok : theme.cont,
                            borderColor: isPlugOn ? theme.ok : theme.line,
                          },
                        ]}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          handleToggle(plug.id);
                        }}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: isPlugOn }}
                        accessibilityLabel={`Smart plug ${plug.name}, ${isPlugOn ? 'Naka-on' : 'Naka-off'}. Pindutin para i-toggle.`}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.toggleIndicatorDot,
                            {
                              backgroundColor: isPlugOn ? '#FFFFFF' : theme.muted,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.toggleBtnText,
                            {
                              color: isPlugOn ? '#FFFFFF' : theme.ink,
                              fontSize: 12 * fontScale,
                            },
                          ]}
                        >
                          {isPlugOn ? 'ON' : 'OFF'}
                        </Text>
                      </TouchableOpacity>

                      {/* Small Arrow / Chevron */}
                      <View style={styles.chevronWrapper}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                          <Path
                            d={isExpanded ? 'M18 15L12 9L6 15' : 'M6 9L12 15L18 9'}
                            stroke={theme.ink}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Telemetry, Timers, Schedule, and Tips */}
                  {isExpanded && (
                    <View style={styles.expandedSection}>

                  {/* Telemetry Metrics Grid (All Necessary Data) */}
                  <View style={[styles.telemetryGrid, { backgroundColor: theme.cont, borderColor: theme.line }]}>
                    {/* Metric 1: Live Watts */}
                    <View style={styles.telemetryCell}>
                      <Text style={[styles.telemetryLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                        Live Power
                      </Text>
                      <Text
                        style={[
                          styles.telemetryValue,
                          {
                            color: isPlugOn ? theme.brand : theme.muted,
                            fontSize: 16 * fontScale,
                          },
                        ]}
                      >
                        {plug.powerWatts.toFixed(1)} W
                      </Text>
                    </View>

                    {/* Metric 2: RMS Voltage */}
                    <View style={styles.telemetryCell}>
                      <Text style={[styles.telemetryLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                        RMS Voltage
                      </Text>
                      <Text style={[styles.telemetryValue, { color: theme.ink, fontSize: 15 * fontScale }]}>
                        {plug.voltageRms.toFixed(1)} V
                      </Text>
                    </View>

                    {/* Metric 3: Current in Amps */}
                    <View style={styles.telemetryCell}>
                      <Text style={[styles.telemetryLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                        Current
                      </Text>
                      <Text style={[styles.telemetryValue, { color: theme.ink, fontSize: 15 * fontScale }]}>
                        {plug.currentAmps.toFixed(2)} A
                      </Text>
                    </View>

                    {/* Metric 4: Power Factor */}
                    <View style={styles.telemetryCell}>
                      <Text style={[styles.telemetryLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                        Power Factor
                      </Text>
                      <Text style={[styles.telemetryValue, { color: theme.ink, fontSize: 15 * fontScale }]}>
                        {plug.powerFactor.toFixed(2)} PF
                      </Text>
                    </View>

                    {/* Metric 5: Accumulated kWh */}
                    <View style={styles.telemetryCell}>
                      <Text style={[styles.telemetryLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                        Konsumo
                      </Text>
                      <Text style={[styles.telemetryValue, { color: theme.ink, fontSize: 15 * fontScale }]}>
                        {plug.accumulatedKwh.toFixed(1)} kWh
                      </Text>
                    </View>

                    {/* Metric 6: Estimated Meralco Cost */}
                    <View style={styles.telemetryCell}>
                      <Text style={[styles.telemetryLabel, { color: theme.muted, fontSize: 11 * fontScale }]}>
                        Tinatayang Gastos
                      </Text>
                      <Text style={[styles.telemetryValue, { color: theme.ok, fontSize: 15 * fontScale }]}>
                        ₱{plug.monthlyCost.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Auto-Off Timer Configuration Bar */}
                  <View style={styles.timerSection}>
                    <View style={styles.sectionHeaderRow}>
                      <View style={styles.sectionTitleRow}>
                        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" style={{ marginRight: 5 }}>
                          <Circle cx="12" cy="13" r="8" stroke={theme.ink} strokeWidth="2.2" />
                          <Path d="M12 9V13L15 15" stroke={theme.ink} strokeWidth="2" strokeLinecap="round" />
                          <Path d="M10 2H14" stroke={theme.ink} strokeWidth="2.2" strokeLinecap="round" />
                        </Svg>
                        <Text style={[styles.sectionSectionTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                          Auto-Off Timer
                        </Text>
                      </View>

                      {isTimerActive && (
                        <View style={[styles.activeTimerBadge, { backgroundColor: theme.warnBg, borderColor: theme.warn }]}>
                          <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                            <Circle cx="12" cy="12" r="9" stroke={theme.warn} strokeWidth="2.2" />
                            <Path d="M12 7V12L15 14" stroke={theme.warn} strokeWidth="2" strokeLinecap="round" />
                          </Svg>
                          <Text style={[styles.activeTimerText, { color: theme.warn, fontSize: 12 * fontScale }]}>
                            Patay sa: {formatTimerRemaining(plug.timer?.remainingSeconds || 0)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => cancelPlugTimer(plug.id)}
                            accessibilityLabel="Kanselahin ang timer"
                            style={styles.cancelTimerBtn}
                          >
                            <Text style={[styles.cancelTimerText, { color: theme.danger, fontSize: 11 * fontScale }]}>
                              Kanselahin
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* Quick Preset Buttons */}
                    <View style={styles.timerPresetsRow}>
                      {[
                        { mins: 15, label: '+15m' },
                        { mins: 30, label: '+30m' },
                        { mins: 60, label: '+1h' },
                        { mins: 120, label: '+2h' },
                      ].map((t) => (
                        <TouchableOpacity
                          key={t.mins}
                          style={[
                            styles.presetBtn,
                            {
                              backgroundColor: theme.surface,
                              borderColor: theme.line,
                            },
                          ]}
                          onPress={() => handleSetQuickTimer(plug.id, t.mins)}
                          accessibilityRole="button"
                          accessibilityLabel={`Mag-set ng ${t.label} auto-off timer`}
                        >
                          <Text style={[styles.presetBtnText, { color: theme.ink, fontSize: 12 * fontScale }]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}

                      <TouchableOpacity
                        style={[
                          styles.presetBtnCustom,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.brand,
                          },
                        ]}
                        onPress={() => handleOpenCustomTimer(plug.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Iba pang oras ng timer"
                      >
                        <Text style={[styles.presetBtnCustomText, { color: theme.brand, fontSize: 12 * fontScale }]}>
                          Iba pa...
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Schedule Configuration Bar */}
                  <View style={[styles.scheduleSection, { borderTopColor: theme.line }]}>
                    <View style={styles.scheduleRow}>
                      <View style={styles.scheduleLeft}>
                        <View style={styles.scheduleTitleWrap}>
                          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginRight: 5 }}>
                            <Rect x="3" y="4" width="18" height="18" rx="3" stroke={theme.ink} strokeWidth="2" />
                            <Path d="M16 2V6M8 2V6M3 10H21" stroke={theme.ink} strokeWidth="2" strokeLinecap="round" />
                          </Svg>
                          <Text style={[styles.sectionSectionTitle, { color: theme.ink, fontSize: 13 * fontScale }]}>
                            Iskedyul:
                          </Text>
                          <Text
                            style={[
                              styles.scheduleStatusText,
                              {
                                color: isScheduleEnabled ? theme.ok : theme.muted,
                                fontSize: 13 * fontScale,
                              },
                            ]}
                          >
                            {isScheduleEnabled
                              ? isScheduleRunningNow
                                ? `Kasalukuyang Umaandar (${plug.schedule?.startTime} – ${plug.schedule?.endTime})`
                                : `${plug.schedule?.startTime} – ${plug.schedule?.endTime} (${plug.schedule?.label || 'Nakahanda'})`
                              : 'Naka-off'}
                          </Text>
                        </View>
                        {isScheduleEnabled && plug.schedule?.days && (
                          <Text style={[styles.scheduleDaysSub, { color: theme.muted, fontSize: 11 * fontScale }]}>
                            {plug.schedule.days.length === 7 ? 'Araw-araw' : plug.schedule.days.join(', ')}
                          </Text>
                        )}
                      </View>

                      <View style={styles.scheduleRightBtns}>
                        <TouchableOpacity
                          style={[
                            styles.scheduleToggleBtn,
                            {
                              backgroundColor: isScheduleEnabled ? theme.okBg : theme.cont,
                              borderColor: isScheduleEnabled ? theme.ok : theme.line,
                            },
                          ]}
                          onPress={() => {
                            triggerHaptic();
                            if (plug.schedule) {
                              setPlugSchedule(plug.id, {
                                ...plug.schedule,
                                enabled: !plug.schedule.enabled,
                              });
                            } else {
                              handleOpenSchedule(plug);
                            }
                          }}
                          accessibilityRole="switch"
                          accessibilityState={{ checked: isScheduleEnabled }}
                          accessibilityLabel="I-toggle ang iskedyul"
                        >
                          <Text
                            style={[
                              styles.scheduleToggleText,
                              {
                                color: isScheduleEnabled ? theme.ok : theme.muted,
                                fontSize: 12 * fontScale,
                              },
                            ]}
                          >
                            {isScheduleEnabled ? 'Naka-set' : 'I-enable'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.editScheduleBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
                          onPress={() => handleOpenSchedule(plug)}
                          accessibilityRole="button"
                          accessibilityLabel="I-edit ang iskedyul"
                        >
                          <Text style={[styles.editScheduleText, { color: theme.brand, fontSize: 12 * fontScale }]}>
                            I-edit
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Energy-Saving Tip from Tipi */}
                  {plug.tip ? (
                    <View style={[styles.tipCard, { backgroundColor: theme.warnBg, borderColor: theme.warn }]}>
                      <View style={styles.tipInnerRow}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginRight: 6, marginTop: 1 }}>
                          <Path
                            d="M9 18H15M10 22H14M12 2C8.13401 2 5 5.13401 5 9C5 11.3867 6.19694 13.4984 8 14.7428V16C8 16.5523 8.44772 17 9 17H15C15.5523 17 16 16.5523 16 16V14.7428C17.8031 13.4984 19 11.3867 19 9C19 5.13401 15.866 2 12 2Z"
                            stroke={theme.ink}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                        <Text style={[styles.tipText, { color: theme.ink, fontSize: 12 * fontScale, flex: 1 }]}>
                          <Text style={{ fontWeight: '700' }}>Tip ni Tipi:</Text> {plug.tip}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </PageTransitionView>

      {/* Custom Timer Dialog Modal */}
      <Modal
        visible={!!timerModalPlugId}
        transparent
        animationType="fade"
        onRequestClose={() => setTimerModalPlugId(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalDialog,
              {
                backgroundColor: theme.surface,
                borderColor: theme.line,
                shadowColor: theme.ink,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.ink, fontSize: 18 * fontScale }]}>
              Mag-set ng Custom Timer
            </Text>
            <Text style={[styles.modalSub, { color: theme.muted, fontSize: 13 * fontScale }]}>
              Ilagay kung ilang minuto bago kusang patayin ang smart plug:
            </Text>

            <View style={[styles.inputRow, { borderColor: theme.line, backgroundColor: theme.cont }]}>
              <TextInput
                style={[styles.numberInput, { color: theme.ink, fontSize: 24 * fontScale }]}
                keyboardType="numeric"
                value={customMinutes}
                onChangeText={setCustomMinutes}
                maxLength={4}
                autoFocus
              />
              <Text style={[styles.inputUnit, { color: theme.muted, fontSize: 16 * fontScale }]}>
                minuto
              </Text>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { borderColor: theme.line }]}
                onPress={() => setTimerModalPlugId(null)}
              >
                <Text style={[styles.modalBtnCancelText, { color: theme.muted, fontSize: 14 * fontScale }]}>
                  Kanselahin
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtnConfirm, { backgroundColor: theme.brand }]}
                onPress={handleSaveCustomTimer}
              >
                <Text style={[styles.modalBtnConfirmText, { color: theme.brandInk, fontSize: 14 * fontScale }]}>
                  Simulan ang Timer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Schedule Configuration Modal */}
      <Modal
        visible={!!scheduleModalPlug}
        transparent
        animationType="slide"
        onRequestClose={() => setScheduleModalPlug(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.scheduleModalDialog,
              {
                backgroundColor: theme.surface,
                borderColor: theme.line,
                shadowColor: theme.ink,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.ink, fontSize: 18 * fontScale }]}>
              I-configure ang Iskedyul
            </Text>
            <Text style={[styles.modalSub, { color: theme.muted, fontSize: 13 * fontScale }]}>
              {scheduleModalPlug?.name} ({scheduleModalPlug?.appliance})
            </Text>

            {/* Presets */}
            <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 * fontScale }]}>
              Mga Mabilisang Iskedyul:
            </Text>
            <View style={styles.schedulePresetsWrap}>
              {[
                { label: 'Off-Peak Lang', start: '21:00', end: '08:00', name: 'Off-Peak Saver' },
                { label: 'Gabi Hanggang Umaga', start: '22:00', end: '06:00', name: 'Night Sleep' },
                { label: 'Work Hours Off', start: '08:00', end: '17:00', name: 'Workday Eco' },
              ].map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={[styles.schedPresetChip, { backgroundColor: theme.cont, borderColor: theme.line }]}
                  onPress={() => {
                    setSchedStartTime(p.start);
                    setSchedEndTime(p.end);
                    setSchedLabel(p.name);
                  }}
                >
                  <Text style={[styles.schedPresetChipText, { color: theme.ink, fontSize: 11 * fontScale }]}>
                    {p.label} ({p.start}–{p.end})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time inputs */}
            <View style={styles.timeInputsRow}>
              <View style={styles.timeInputCol}>
                <Text style={[styles.timeLabel, { color: theme.muted, fontSize: 12 * fontScale }]}>
                  Oras ng Pag-ON:
                </Text>
                <TextInput
                  style={[
                    styles.timeField,
                    { color: theme.ink, backgroundColor: theme.cont, borderColor: theme.line },
                  ]}
                  value={schedStartTime}
                  onChangeText={setSchedStartTime}
                  placeholder="22:00"
                  maxLength={5}
                />
              </View>

              <View style={styles.timeInputCol}>
                <Text style={[styles.timeLabel, { color: theme.muted, fontSize: 12 * fontScale }]}>
                  Oras ng Pag-OFF:
                </Text>
                <TextInput
                  style={[
                    styles.timeField,
                    { color: theme.ink, backgroundColor: theme.cont, borderColor: theme.line },
                  ]}
                  value={schedEndTime}
                  onChangeText={setSchedEndTime}
                  placeholder="06:00"
                  maxLength={5}
                />
              </View>
            </View>

            {/* Day selector */}
            <Text style={[styles.fieldLabel, { color: theme.ink, fontSize: 13 * fontScale, marginTop: 12 }]}>
              Mga Araw na Uulitin:
            </Text>
            <View style={styles.daysRow}>
              {ALL_DAYS.map((d) => {
                const isSelected = schedDays.includes(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: isSelected ? theme.brand : theme.cont,
                        borderColor: isSelected ? theme.brand : theme.line,
                      },
                    ]}
                    onPress={() => handleToggleDay(d)}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        {
                          color: isSelected ? theme.brandInk : theme.ink,
                          fontSize: 11 * fontScale,
                        },
                      ]}
                    >
                      {d.slice(0, 2)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Actions */}
            <View style={[styles.modalBtnRow, { marginTop: 20 }]}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { borderColor: theme.line }]}
                onPress={() => setScheduleModalPlug(null)}
              >
                <Text style={[styles.modalBtnCancelText, { color: theme.muted, fontSize: 14 * fontScale }]}>
                  Kanselahin
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtnConfirm, { backgroundColor: theme.brand }]}
                onPress={handleSaveSchedule}
              >
                <Text style={[styles.modalBtnConfirmText, { color: theme.brandInk, fontSize: 14 * fontScale }]}>
                  I-save ang Iskedyul
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
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTextGroup: { flex: 1 },
  title: { fontWeight: '400', letterSpacing: 0.2 },
  subTitle: { fontWeight: '400', letterSpacing: 0.4, marginTop: 2 },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveSimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveSimText: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  masterHeroCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  masterTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  masterLabel: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  masterWattsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  masterWattsValue: {
    fontWeight: '400',
    letterSpacing: 0.4,
  },
  masterWattsUnit: {
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  masterRightPillGroup: {
    alignItems: 'flex-end',
  },
  activeCountBadge: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  activeCountText: {
    fontWeight: '700',
  },
  masterStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  masterStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '800',
  },
  statLabel: {
    fontWeight: '600',
    marginTop: 2,
  },
  masterDivider: {
    width: 1,
    height: 24,
  },
  masterActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  masterBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterBtnText: {
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillText: {
    fontWeight: '700',
  },
  plugsList: {
    gap: 12,
  },
  plugCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveWattsPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveWattsPillText: {
    fontWeight: '800',
  },
  chevronWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedSection: {
    marginTop: 10,
  },
  cardInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameLocationWrap: {
    flex: 1,
  },
  plugTitle: {
    fontWeight: '800',
  },
  plugSubtitle: {
    fontWeight: '500',
    marginTop: 2,
  },
  dedicatedToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 34,
    minWidth: 64,
    borderRadius: 17,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  toggleIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleBtnText: {
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  telemetryCell: {
    width: '33.33%',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
  },
  telemetryLabel: {
    fontWeight: '600',
    marginBottom: 2,
  },
  telemetryValue: {
    fontWeight: '800',
  },
  timerSection: {
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionSectionTitle: {
    fontWeight: '700',
  },
  activeTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  activeTimerText: {
    fontWeight: '700',
  },
  cancelTimerBtn: {
    paddingLeft: 4,
  },
  cancelTimerText: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  timerPresetsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  presetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnText: {
    fontWeight: '700',
  },
  presetBtnCustom: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetBtnCustomText: {
    fontWeight: '700',
  },
  scheduleSection: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 6,
  },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleLeft: {
    flex: 1,
    marginRight: 8,
  },
  scheduleTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  scheduleStatusText: {
    fontWeight: '700',
  },
  scheduleDaysSub: {
    fontWeight: '500',
    marginTop: 2,
  },
  scheduleRightBtns: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  scheduleToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleToggleText: {
    fontWeight: '700',
  },
  editScheduleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editScheduleText: {
    fontWeight: '700',
  },
  tipCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 6,
  },
  tipText: {
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  scheduleModalDialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    lineHeight: 18,
    marginBottom: 16,
  },
  fieldLabel: {
    fontWeight: '700',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 54,
    marginBottom: 20,
  },
  numberInput: {
    flex: 1,
    fontWeight: '900',
  },
  inputUnit: {
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalBtnCancel: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: {
    fontWeight: '700',
  },
  modalBtnConfirm: {
    flex: 1.5,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnConfirmText: {
    fontWeight: '800',
  },
  schedulePresetsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  schedPresetChip: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  schedPresetChipText: {
    fontWeight: '600',
  },
  timeInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputCol: {
    flex: 1,
  },
  timeLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  timeField: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontWeight: '700',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  dayChip: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipText: {
    fontWeight: '800',
  },
  masterSubtext: {
    fontWeight: '600',
    marginTop: 4,
  },
  liveActiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activeDotBeacon: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipInnerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  emptyContainer: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  emptyTitle: {
    fontWeight: '800',
    marginTop: 10,
  },
  emptySubtitle: {
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  resetFilterBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetFilterBtnText: {
    fontWeight: '700',
  },
});
