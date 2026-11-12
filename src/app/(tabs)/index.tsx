import React from 'react';
import { UsageAnalysisCard } from '../../components/UsageAnalysisCard';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useEnergy } from '../../context/EnergyContext';
import { BudgetGauge } from '../../components/BudgetGauge';
import { TipiMascot } from '../../components/TipiMascot';
import { ApplianceBreakdownCard } from '../../components/ApplianceBreakdownCard';
import { HeaderAlertButton } from '../../components/HeaderAlertButton';
import { HeaderSettingsButton } from '../../components/HeaderSettingsButton';
import { calculateTierCliff } from '../../lib/tariffEngine';
import { MOCK_APPLIANCES, MOCK_USER } from '../../constants/mockData';

export default function HomeScreen() {
  const { theme, fontScale } = useTheme();
  const {
    budget,
    projected,
    currentKwh,
    activeBill,
    activeCanProfile,
  } = useEnergy();

  const cliff = calculateTierCliff(currentKwh);
  const canNumber = activeBill?.customerAccountNumber || activeCanProfile?.accountNumber || MOCK_USER.accountNumber;
  const userName = activeCanProfile?.customerName || MOCK_USER.name;
  const profileName = activeCanProfile?.name || 'Bahay (Pasig)';
  const ratePerKwh = activeCanProfile?.ratePerKwh || MOCK_USER.ratePerKwh;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={styles.headerTextGroup}>
            <Text style={[styles.greetingTitle, { color: theme.ink, fontSize: 22 * fontScale }]}>
              Magandang araw, {userName}!
            </Text>
            <Text style={[styles.canSubtitle, { color: theme.muted, fontSize: 13 * fontScale }]}>
              CAN: {canNumber} · {profileName}
            </Text>
          </View>
          <View style={styles.headerRightGroup}>
            <TipiMascot size="mini" />
            <HeaderAlertButton from="index" />
            <HeaderSettingsButton />
          </View>
        </View>

        {/* Budget Circular Gauge Card */}
        <BudgetGauge projected={projected} budget={budget} />

        <UsageAnalysisCard />

        {/* Live Grid Metrics Row */}
        <View style={styles.metricsRow}>
          <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.metricValue, { color: theme.brand, fontSize: 20 * fontScale }]}>
              {currentKwh} kWh
            </Text>
            <Text style={[styles.metricLabel, { color: theme.muted, fontSize: 12 * fontScale }]}>
              Konsumo
            </Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            <Text style={[styles.metricValue, { color: theme.ok, fontSize: 20 * fontScale }]}>
              ₱{ratePerKwh}
            </Text>
            <Text style={[styles.metricLabel, { color: theme.muted, fontSize: 12 * fontScale }]}>
              Rate / kWh
            </Text>
          </View>
        </View>

        {/* Primary CTA: What-If Watt-Calculator */}
        <TouchableOpacity
          style={[styles.primaryActionCard, { backgroundColor: theme.brand }]}
          onPress={() => router.push('/whatif')}
          accessibilityRole="button"
          accessibilityLabel="Buksan ang What-If Watt Calculator"
        >
          <View style={styles.actionCardContent}>
            <Text style={[styles.actionCardTitle, { color: theme.brandInk, fontSize: 18 * fontScale }]}>
              What-If Watt-Calculator 💡
            </Text>
            <Text style={[styles.actionCardSub, { color: theme.brandInk, fontSize: 13 * fontScale }]}>
              Tingnan ang matitipid sa pag-adjust ng aircon at appliances.
            </Text>
          </View>
        </TouchableOpacity>

        {/* iPad Storage Style Scrollable Appliance Disaggregation Card */}
        <ApplianceBreakdownCard appliances={MOCK_APPLIANCES} totalKwh={currentKwh} />

        {/* Quick Action: Scan Meralco Bill */}
        <TouchableOpacity
          style={[styles.secondaryActionCard, { backgroundColor: theme.surface, borderColor: theme.line }]}
          onPress={() => router.push('/(tabs)/bill')}
          accessibilityRole="button"
          accessibilityLabel="I-scan ang Meralco Bill"
        >
          <Text style={[styles.secondaryTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
            I-scan ang Meralco Bill 📄
          </Text>
          <Text style={[styles.secondarySub, { color: theme.muted, fontSize: 13 * fontScale }]}>
            Kumuha ng litrato o mag-upload ng kopya ng bill.
          </Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greetingTitle: {
    fontWeight: '800',
  },
  canSubtitle: {
    fontWeight: '600',
    marginTop: 2,
  },
  forecastBox: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginVertical: 6,
  },
  forecastBody: {
    lineHeight: 18,
    fontWeight: '600',
  },
  cliffCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginVertical: 6,
  },
  cliffText: {
    fontWeight: '600',
    lineHeight: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 6,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    fontWeight: '600',
  },
  primaryActionCard: {
    borderRadius: 16,
    padding: 16,
    marginVertical: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  actionCardContent: {
    gap: 2,
  },
  actionCardTitle: {
    fontWeight: '800',
  },
  actionCardSub: {
    opacity: 0.95,
    lineHeight: 18,
  },
  secondaryActionCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginVertical: 6,
  },
  secondaryTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  secondarySub: {
    lineHeight: 18,
  },
});
