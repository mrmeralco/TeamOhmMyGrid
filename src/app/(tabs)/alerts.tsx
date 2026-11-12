import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useEnergy } from '../../context/EnergyContext';
import { scheduleApplianceDelayReminder } from '../../lib/notificationService';
import { buildAlertsExplanationPrompt } from '../../lib/geminiService';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { PageTransitionView } from '../../components/PageTransitionView';

interface ApplianceItem {
  id: string;
  name: string;
  watts: number;
}

const APPLIANCES: ApplianceItem[] = [
  { id: 'plantsa', name: 'Plantsa (Flat Iron)', watts: 1000 },
  { id: 'wm', name: 'Washing Machine', watts: 500 },
  { id: 'heater', name: 'Shower Water Heater', watts: 1500 },
  { id: 'ac', name: 'Inverter Aircon', watts: 1100 },
];

export default function AlertsScreen() {
  const { theme, fontScale, language } = useTheme();
  const isEnglish = language === 'english';
  const { currentKwh, projected, budget, askTipi } = useEnergy();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [activeFilter, setActiveFilter] = useState<'all' | 'budget' | 'peak'>('all');

  const handleBack = () => {
    if (from) {
      if (from === 'index') {
        router.navigate('/(tabs)/');
      } else {
        router.navigate(`/(tabs)/${from}` as any);
      }
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)/');
    }
  };

  const handleScheduleDelay = async (appliance: ApplianceItem, hours: number) => {
    const delayMinutes = hours * 60;
    const notificationId = await scheduleApplianceDelayReminder(appliance.name, delayMinutes);
    if (notificationId) {
      Alert.alert(
        'Reminder Naka-set',
        `Pinaalalahanan ka sa ${appliance.name} pagkatapos ng ${hours} oras para makaiwas sa peak rates.`
      );
    } else {
      Alert.alert('Paalala', 'Pakibigyan ng pahintulot ang app para sa mga notification.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <PageTransitionView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: '#FF6B0030' }]}
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Bumalik"
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 12H5M12 19L5 12L12 5"
                  stroke={theme.ink}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>
            <View style={styles.headerTextGroup}>
              <Text style={[styles.title, { color: theme.ink, fontSize: 24 * fontScale, fontFamily: 'Coolvetica' }]}>
                {isEnglish ? (
                  <>
                    <Text style={{ color: '#FF6B00' }}>Alerts</Text> & Scheduler
                  </>
                ) : (
                  <>
                    Mga <Text style={{ color: '#FF6B00' }}>Babala</Text> at Scheduler
                  </>
                )}
              </Text>
              <Text style={[styles.subTitle, { color: theme.muted, fontSize: 13 * fontScale, fontFamily: 'Coolvetica' }]}>
                Grid Peak Alerts & Action Reminders
              </Text>
            </View>
            <HeaderSettingsButton />
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {(['all', 'budget', 'peak'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: activeFilter === filter ? '#FF5500' : theme.surface,
                    borderColor: activeFilter === filter ? '#FF5500' : '#FF6B002B',
                  },
                ]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: activeFilter === filter ? '#ffffff' : theme.ink,
                      fontSize: 13 * fontScale,
                      fontFamily: 'Coolvetica',
                    },
                  ]}
                >
                  {filter === 'all' ? (isEnglish ? 'All' : 'Lahat') : filter === 'budget' ? 'Budget' : 'Peak Hours'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Peak Window Alert Card */}
          {(activeFilter === 'all' || activeFilter === 'peak') && (
            <View style={[styles.peakNoticeCard, { backgroundColor: theme.peakBg, borderColor: theme.peak }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: theme.ink, fontSize: 14 * fontScale }]}>
                  ⚡ Peak: 8:00 AM – 9:00 PM
                </Text>
                <Text style={[styles.cardTag, { color: theme.peak, fontSize: 11 * fontScale }]}>
                  {isEnglish ? 'Mon – Sat' : 'Lunes – Sabado'}
                </Text>
              </View>
              <Text style={[styles.cardSub, { color: theme.ink, fontSize: 12 * fontScale }]}>
                {isEnglish
                  ? 'Grid demand is high. Shift heavy appliances to off-peak hours.'
                  : 'Mataas ang demand sa grid. I-shift ang mabibigat na appliances sa off-peak.'}
              </Text>
            </View>
          )}

          {/* Budget Alert Card */}
          {(activeFilter === 'all' || activeFilter === 'budget') && (
            <View style={[styles.budgetAlertCard, { backgroundColor: theme.warnBg, borderColor: theme.warn }]}>
              <View style={styles.cardHeaderRow}>
                <Text style={[styles.cardTitle, { color: theme.ink, fontSize: 14 * fontScale }]}>
                  {isEnglish ? '81% of Monthly Budget' : '81% ng Buwanang Budget'}
                </Text>
              </View>
              <Text style={[styles.cardSub, { color: theme.ink, fontSize: 12 * fontScale }]}>
                {isEnglish
                  ? '10 days left before cut-off. Reduce aircon runtime to stay under ₱3,500.'
                  : 'May 10 araw pa bago ang cut-off. Bawasan ang oras ng aircon para hindi lumagpas sa ₱3,500.'}
              </Text>
            </View>
          )}

          {/* Appliance Deferral Shift Scheduler */}
          <View style={styles.schedulerSection}>
            <Text style={[styles.sectionTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
              {isEnglish ? 'Delay Appliances' : 'I-delay ang Appliances'}
            </Text>

            <View style={styles.applianceList}>
              {APPLIANCES.map((item) => (
                <View
                  key={item.id}
                  style={[styles.applianceCard, { backgroundColor: theme.surface, borderColor: theme.line }]}
                >
                  <View style={styles.applianceInfo}>
                    <Text style={[styles.applianceName, { color: theme.ink, fontSize: 14 * fontScale }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.applianceWatts, { color: theme.brand, fontSize: 12 * fontScale }]}>
                      {item.watts} W
                    </Text>
                  </View>

                  {/* Shift Delay Buttons */}
                  <View style={styles.delayButtonsRow}>
                    {[1, 2, 3].map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.delayBtn,
                          {
                            backgroundColor: h === 3 ? theme.brand : theme.cont,
                            borderColor: h === 3 ? theme.brand : theme.line,
                          },
                        ]}
                        onPress={() => handleScheduleDelay(item, h)}
                      >
                        <Text
                          style={[
                            styles.delayBtnText,
                            {
                              color: h === 3 ? theme.brandInk : theme.ink,
                              fontSize: 12 * fontScale,
                            },
                          ]}
                        >
                          +{h}h
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Ask Tipi Explanation Card */}
          <TouchableOpacity
            style={[
              styles.applianceCard,
              {
                backgroundColor: theme.cont,
                borderColor: theme.line,
                marginTop: 12,
                justifyContent: 'center',
                paddingVertical: 13,
              },
            ]}
            onPress={() =>
              askTipi(
                buildAlertsExplanationPrompt({
                  currentKwh,
                  projected,
                  budget,
                  language,
                })
              )
            }
            accessibilityRole="button"
            accessibilityLabel={isEnglish ? 'Explain Peak Hours and Alerts with Tipi' : 'Ipaliwanag kay Tipi ang Peak Hours at Alerts'}
          >
            <Text style={[styles.applianceName, { color: theme.ink, fontSize: 14 * fontScale, textAlign: 'center' }]}>
              {isEnglish ? 'Explain Peak Hours & Alerts with Tipi' : 'Ipaliwanag kay Tipi ang Peak Hours at Alerts'}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 110 }} />
        </ScrollView>
      </PageTransitionView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  title: { fontWeight: '400', letterSpacing: 0.2 },
  subTitle: { fontWeight: '400', letterSpacing: 0.3, marginTop: 2 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterPill: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: { fontWeight: '400', letterSpacing: 0.3 },
  peakNoticeCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 4,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardTitle: { fontWeight: '400', letterSpacing: 0.3, fontFamily: 'Coolvetica' },
  cardTag: { fontWeight: '400', fontFamily: 'Coolvetica' },
  cardSub: { lineHeight: 16, fontWeight: '400' },
  budgetAlertCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 4,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  schedulerSection: { marginTop: 12 },
  sectionTitle: { fontWeight: '400', letterSpacing: 0.3, marginBottom: 8, fontFamily: 'Coolvetica' },
  applianceList: { gap: 8 },
  applianceCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  applianceInfo: { flex: 1 },
  applianceName: { fontWeight: '400', letterSpacing: 0.3, fontFamily: 'Coolvetica' },
  applianceWatts: { fontWeight: '400', marginTop: 1, fontFamily: 'Coolvetica' },
  delayButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  delayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delayBtnText: { fontWeight: '400', fontFamily: 'Coolvetica' },
});
