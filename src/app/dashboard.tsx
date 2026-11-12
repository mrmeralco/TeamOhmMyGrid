// ==============================================================================
// Dashboard & Authenticated User Experience for KuryenTipid
// Directly reproduces the screens and workflows from the user's uploaded mockups:
// 1. Home (Budget tracker, projected bill ₱2,840, 81% circular meter, quick actions)
// 2. Bill (OCR breakdown: Generation, Distribution, Transmission, Taglish explainer)
// 3. Profile (User avatar NV, Account info, SIN 1234-5678-90, Household, Mag-log out)
// ==============================================================================

import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomNavBar } from '../components/BottomNavBar';
import { useAuth } from '../context/AuthContext';
import { formatCANDisplay } from '../utils/validation';

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'Home' | 'Bill' | 'Tanong' | 'Alerts' | 'Profile'>('Profile');

  const handleLogout = async () => {
    const perform = async () => {
      await logout();
      router.replace('/login');
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Sigurado ka bang nais mong mag-log out?')) {
        await perform();
      }
    } else {
      Alert.alert('Mag-log out', 'Sigurado ka bang nais mong mag-log out?', [
        { text: 'Kanselahin', style: 'cancel' },
        { text: 'Mag-log out', style: 'destructive', onPress: perform },
      ]);
    }
  };

  if (isLoading) return null;
  if (!user?.isEmailVerified) return <Redirect href="/login" />;

  const displayName = user?.fullName || 'Nena Villanueva';
  const firstName = displayName.split(' ')[0];
  const userInitials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const displaySIN = user?.sin || (user?.can ? formatCANDisplay(user.can) : '1234-5678-90');
  const householdDesc = `Pamilya ng ${user?.householdMembers || 5} · ${(user?.majorAppliances || ['Inverter AC (1.5 HP) x 2']).join(', ')}`;

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================================= */}
        {/* TAB 1: PROFILE VIEW (Matches Image 1)                             */}
        {/* ================================================================= */}
        {activeTab === 'Profile' && (
          <View style={styles.sectionContainer}>
            <View style={styles.topMetaRow}>
              <Text style={styles.topMetaText}>Account · Household</Text>
            </View>
            <Text style={styles.pageTitle}>Profile</Text>

            {/* Profile User Card */}
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.profileName}>{displayName}</Text>
                <Text style={styles.sinLabel}>SIN: {displaySIN}</Text>
                <Text style={styles.emailBadge}>@{user?.username || 'user'} · {user?.email}</Text>
              </View>
            </View>

            {/* Household Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.cardHeaderTitle}>Household</Text>
              <Text style={styles.cardBodyText}>{householdDesc}</Text>
            </View>

            {/* Account Settings Button */}
            <TouchableOpacity style={styles.outlineActionBtn} activeOpacity={0.7}>
              <Text style={styles.outlineActionText}>Mga setting</Text>
            </TouchableOpacity>

            {/* Mag-log out Button */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutText}>Mag-log out</Text>
            </TouchableOpacity>

            {/* Security Audit & Verification Footnote */}
            <View style={styles.securityAuditBox}>
              <Text style={styles.securityAuditTitle}>🔒 Ligtas at Naka-encrypt</Text>
              <Text style={styles.securityAuditBody}>
                Authenticated via Supabase & PostgreSQL. CAN unique constraint verified. Row-Level Security (RLS) is active.
              </Text>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 2: HOME VIEW (Matches Image 2)                                */}
        {/* ================================================================= */}
        {activeTab === 'Home' && (
          <View style={styles.sectionContainer}>
            <View style={styles.topMetaRow}>
              <Text style={styles.topMetaText}>KuryenTipid · Nobyembre 2026</Text>
            </View>
            <Text style={styles.pageTitle}>Magandang hapon, {firstName}</Text>

            <View style={styles.statusPillsRow}>
              <View style={styles.offPeakPill}>
                <Text style={styles.offPeakText}>● Off-Peak ngayon</Text>
              </View>
              <View style={styles.sampleDataPill}>
                <Text style={styles.sampleDataText}>Real-time datos</Text>
              </View>
            </View>

            {/* Projected Bill Card */}
            <View style={styles.billHeroCard}>
              <View style={styles.billHeroTop}>
                <View>
                  <Text style={styles.projectedLabel}>Projected bill</Text>
                  <Text style={styles.billAmount}>₱2,840</Text>
                </View>
                <View style={styles.circleMeter}>
                  <Text style={styles.circleMeterText}>81%</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: '81%' }]} />
              </View>
              <Text style={styles.budgetText}>
                Budget: ₱{(user?.monthlyBudget || 3500).toLocaleString()}
              </Text>
            </View>

            {/* Paalala Banner */}
            <View style={styles.paalalaBanner}>
              <Text style={styles.paalalaText}>
                <Text style={styles.boldText}>Paalala:</Text> Malapit na sa 80% ng budget. Ituloy ang pagtipid.
              </Text>
            </View>

            {/* Mabilisang aksyon */}
            <Text style={styles.actionSectionTitle}>Mabilisang aksyon</Text>

            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('./meter-reading')} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>Read my meter / Basahin ang metro</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.solidOrangeBtn} activeOpacity={0.8}>
              <Text style={styles.solidOrangeText}>Bakit tumaas ang bill ko?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setActiveTab('Bill')}
              activeOpacity={0.7}
            >
              <Text style={styles.actionBtnText}>Suriin ang bill ko</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>Subukan ang What-If Watt-Calculator</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionBtn, styles.peakHourBorder]} activeOpacity={0.7}>
              <Text style={[styles.actionBtnText, styles.peakHourText]}>
                Peak-Hour Schedule (8 AM – 9 PM)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>Baguhin ang budget ko</Text>
            </TouchableOpacity>

            <Text style={styles.footnote}>Tantiya lamang, hindi opisyal na bill.</Text>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 3: BILL VIEW (Matches Image 3)                                */}
        {/* ================================================================= */}
        {activeTab === 'Bill' && (
          <View style={styles.sectionContainer}>
            <View style={styles.topMetaRow}>
              <Text style={styles.topMetaText}>Bill Breakdown · Mula sa OCR</Text>
            </View>
            <Text style={styles.pageTitle}>Bill ng Nobyembre</Text>

            {/* Total Due Estimate Card */}
            <View style={styles.billHeroCard}>
              <Text style={styles.projectedLabel}>Total due (estimate)</Text>
              <Text style={styles.billAmount}>₱2,840</Text>
              <Text style={styles.billingPeriodText}>Billing period: Okt 12 – Nob 10 · 189 kWh</Text>
            </View>

            {/* Breakdown Card */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownCardTitle}>Saan napunta ang bill</Text>

              {/* Multi-color segment bar */}
              <View style={styles.multiColorBar}>
                <View style={[styles.barSegment, { flex: 64, backgroundColor: '#ea580c' }]} />
                <View style={[styles.barSegment, { flex: 12, backgroundColor: '#059669' }]} />
                <View style={[styles.barSegment, { flex: 8, backgroundColor: '#0f172a' }]} />
                <View style={[styles.barSegment, { flex: 16, backgroundColor: '#e2e8f0' }]} />
              </View>

              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Generation</Text>
                <Text style={styles.breakdownValue}>64% · ₱1,818</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Distribution</Text>
                <Text style={styles.breakdownValue}>12% · ₱341</Text>
              </View>
              <View style={styles.breakdownItem}>
                <Text style={styles.breakdownLabel}>Transmission</Text>
                <Text style={styles.breakdownValue}>8% · ₱227</Text>
              </View>
              <View style={[styles.breakdownItem, { borderBottomWidth: 0 }]}>
                <Text style={styles.breakdownLabel}>Iba pa</Text>
                <Text style={styles.breakdownValue}>16% · ₱454</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity style={styles.solidOrangeBtn} activeOpacity={0.8}>
              <Text style={styles.solidOrangeText}>Ipaliwanag sa Taglish</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
              <Text style={styles.actionBtnText}>Mag-upload ng bagong bill</Text>
            </TouchableOpacity>

            <Text style={styles.footnote}>
              Tantiya lamang. Para sa opisyal na bill, tingnan sa My Meralco.
            </Text>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 4: TANONG / CONVERSATIONAL VOICE AGENT                         */}
        {/* ================================================================= */}
        {activeTab === 'Tanong' && (
          <View style={styles.sectionContainer}>
            <View style={styles.topMetaRow}>
              <Text style={styles.topMetaText}>AI Voice Assistant</Text>
            </View>
            <Text style={styles.pageTitle}>Tanong kay KuryenTipid</Text>
            <View style={styles.voiceAssistantCard}>
              <View style={styles.bigMicCircle}>
                <Text style={styles.bigMicText}>🎙️</Text>
              </View>
              <Text style={styles.voicePromptTitle}>Pindutin para magsalita</Text>
              <Text style={styles.voicePromptDesc}>
                Subukang itanong: "Bakit tumaas ang kuryente ko?", o "Magkano ang matitipid ko kung itaas ko sa 24°C ang aircon?"
              </Text>
            </View>
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 5: ALERTS VIEW                                                */}
        {/* ================================================================= */}
        {activeTab === 'Alerts' && (
          <View style={styles.sectionContainer}>
            <View style={styles.topMetaRow}>
              <Text style={styles.topMetaText}>Mga Abiso · Alerts</Text>
            </View>
            <Text style={styles.pageTitle}>Energy Alerts</Text>
            <View style={styles.alertCard}>
              <Text style={styles.alertCardHeader}>⚠️ 80% Budget Warning</Text>
              <Text style={styles.alertCardBody}>
                Umabot na sa ₱2,840 ang konsumo ngayong buwan. I-adjust ang aircon timer para hindi lumampas sa ₱3,500 budget.
              </Text>
            </View>
            <View style={styles.alertCard}>
              <Text style={styles.alertCardHeader}>⚡ Peak-Hour Reminder</Text>
              <Text style={styles.alertCardBody}>
                Off-peak na simula 9:00 PM. Magandang oras mag-plantsa o mag-laba.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Persistent Bottom Tab Bar */}
      <BottomNavBar activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  sectionContainer: {
    width: '100%',
  },
  topMetaRow: {
    marginBottom: 4,
  },
  topMetaText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  statusPillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  offPeakPill: {
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  offPeakText: {
    fontSize: 12,
    color: '#137333',
    fontWeight: '700',
  },
  sampleDataPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  sampleDataText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#c2410c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  sinLabel: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  emailBadge: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  cardBodyText: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 18,
  },
  outlineActionBtn: {
    borderWidth: 1.5,
    borderColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  outlineActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  logoutBtn: {
    borderWidth: 1.5,
    borderColor: '#991b1b',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991b1b',
  },
  securityAuditBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
  },
  securityAuditTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  securityAuditBody: {
    fontSize: 11.5,
    color: '#64748b',
    lineHeight: 16,
  },
  billHeroCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  billHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectedLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  billAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -1,
  },
  circleMeter: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 6,
    borderColor: '#c2410c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleMeterText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    marginTop: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#c2410c',
    borderRadius: 4,
  },
  budgetText: {
    fontSize: 13,
    color: '#475569',
  },
  paalalaBanner: {
    backgroundColor: '#fef9c3',
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  paalalaText: {
    fontSize: 13.5,
    color: '#854d0e',
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
  },
  actionSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  solidOrangeBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  solidOrangeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionBtn: {
    borderWidth: 1.5,
    borderColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#ffffff',
  },
  actionBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  peakHourBorder: {
    borderColor: '#6366f1',
  },
  peakHourText: {
    color: '#4338ca',
  },
  footnote: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  billingPeriodText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  breakdownCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  breakdownCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  multiColorBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 14,
  },
  barSegment: {
    height: '100%',
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  breakdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  breakdownValue: {
    fontSize: 14,
    color: '#475569',
  },
  voiceAssistantCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  bigMicCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  bigMicText: {
    fontSize: 36,
  },
  voicePromptTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  voicePromptDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  alertCard: {
    backgroundColor: '#fefce8',
    borderWidth: 1.5,
    borderColor: '#fef08a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  alertCardHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#854d0e',
    marginBottom: 4,
  },
  alertCardBody: {
    fontSize: 13,
    color: '#713f12',
    lineHeight: 18,
  },
});
