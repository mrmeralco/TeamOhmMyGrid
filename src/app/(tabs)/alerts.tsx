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
import { scheduleApplianceDelayReminder } from '../../lib/notificationService';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';

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
  const { theme, fontScale } = useTheme();
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
        'Reminder Naka-set ⏰',
        `Pinaalalahanan ka sa ${appliance.name} pagkatapos ng ${hours} oras para makaiwas sa peak rates.`
      );
    } else {
      Alert.alert('Paalala', 'Pakibigyan ng pahintulot ang app para sa mga notification.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: theme.surface, borderColor: theme.line }]}
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
            <Text style={[styles.title, { color: theme.ink, fontSize: 24 * fontScale }]}>
              Mga Babala at Scheduler
            </Text>
            <Text style={[styles.subTitle, { color: theme.muted, fontSize: 13 * fontScale }]}>
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
                  backgroundColor: activeFilter === filter ? theme.brand : theme.surface,
                  borderColor: activeFilter === filter ? theme.brand : theme.line,
                },
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  {
                    color: activeFilter === filter ? theme.brandInk : theme.ink,
                    fontSize: 13 * fontScale,
                  },
                ]}
              >
                {filter === 'all' ? 'Lahat' : filter === 'budget' ? 'Budget' : 'Peak Hours'}
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
                Lunes – Sabado
              </Text>
            </View>
            <Text style={[styles.cardSub, { color: theme.ink, fontSize: 12 * fontScale }]}>
              Mataas ang demand sa grid. I-shift ang mabibigat na appliances sa off-peak.
            </Text>
          </View>
        )}

        {/* Budget Alert Card */}
        {(activeFilter === 'all' || activeFilter === 'budget') && (
          <View style={[styles.budgetAlertCard, { backgroundColor: theme.warnBg, borderColor: theme.warn }]}>
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: theme.ink, fontSize: 14 * fontScale }]}>
                ⚠️ 81% ng Buwanang Budget
              </Text>
            </View>
            <Text style={[styles.cardSub, { color: theme.ink, fontSize: 12 * fontScale }]}>
              May 10 araw pa bago ang cut-off. Bawasan ang oras ng aircon para hindi lumagpas sa ₱3,500.
            </Text>
          </View>
        )}

        {/* Appliance Deferral Shift Scheduler */}
        <View style={styles.schedulerSection}>
          <Text style={[styles.sectionTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            I-delay ang Appliances
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

        <View style={{ height: 100 }} />
      </ScrollView>
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
  title: { fontWeight: '800' },
  subTitle: { fontWeight: '600', marginTop: 2 },
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
  filterText: { fontWeight: '700' },
  peakNoticeCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginVertical: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  cardTitle: { fontWeight: '800' },
  cardTag: { fontWeight: '700' },
  cardSub: { lineHeight: 16, fontWeight: '500' },
  budgetAlertCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    marginVertical: 4,
  },
  schedulerSection: { marginTop: 10 },
  sectionTitle: { fontWeight: '800', marginBottom: 8 },
  applianceList: { gap: 6 },
  applianceCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  applianceInfo: { flex: 1 },
  applianceName: { fontWeight: '700' },
  applianceWatts: { fontWeight: '700', marginTop: 1 },
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
  delayBtnText: { fontWeight: '700' },
});
