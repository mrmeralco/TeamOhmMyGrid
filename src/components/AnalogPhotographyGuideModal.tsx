import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { AnalogMeterType } from '../types/analogMeter';

export interface AnalogPhotographyGuideModalProps {
  visible: boolean;
  onClose: () => void;
  onProceedToCamera?: (meterType?: AnalogMeterType) => void;
  initialMeterType?: AnalogMeterType;
  testID?: string;
}

interface GuideRule {
  id: string;
  badge: string;
  icon: string;
  title: string;
  tagline: string;
  explanation: string;
  doText: string;
  dontText: string;
}

const GUIDE_RULES_DIAL: GuideRule[] = [
  {
    id: 'angle',
    badge: 'Panuntunan 1',
    icon: '📐',
    title: '90° Diretsong Anggulo (Iwas-Parallax)',
    tagline: 'Pantay sa mukha ng metro, hindi patagilid',
    explanation:
      'Kapag patagilid ang litrato, nagkakaroon ng Parallax Error kung saan ang mga karayom (pointers) ay mukhang nakaturo sa maling numero. Hawakan ang telepono nang eksaktong nakaharap sa metro sa 90° angle.',
    doText: 'Itapat ang camera diretso sa gitna ng dial plate.',
    dontText: 'Huwag kumuha mula sa itaas, ibaba, o gilid.',
  },
  {
    id: 'glare',
    badge: 'Panuntunan 2',
    icon: '☀️',
    title: 'Iwas-Silaw at Liwanag (Tanggalin ang Flash)',
    tagline: 'Ambient daytime light, patayin ang camera flash',
    explanation:
      'Ang bilog na salamin ng analog meter ay sumasalamin ng matinding glare kapag may camera flash, na nagtatakip sa mga numero. Gamitin ang natural na liwanag ng araw o diffused light sa paligid.',
    doText: 'Kumuha sa umaga o hapon nang patay ang flash.',
    dontText: 'Huwag gamitin ang direktang flashlight o camera flash.',
  },
  {
    id: 'framing',
    badge: 'Panuntunan 3',
    icon: '🎯',
    title: 'Tamang Framing (~70% ng Screen)',
    tagline: 'Nakasentro ang 5 dials at malinaw ang serial number',
    explanation:
      'Siguraduhing sumasakop ang bilog o parihabang mukha ng metro sa humigit-kumulang 70% ng frame. Huwag masyadong malayo upang hindi maging malabo ang maliliit na dials.',
    doText: 'Pindutin ang screen para mag-autofocus sa 5 dials bago mag-click.',
    dontText: 'Huwag i-crop nang masyadong masikip o lumampas sa gilid.',
  },
  {
    id: 'dials',
    badge: 'Panuntunan 4',
    icon: '⏱️',
    title: 'Laging Kunin ang Mas Mababang Numero',
    tagline: 'Counter-rotating dials: 10,000s hanggang 1s',
    explanation:
      'Ang mga dial ng Meralco meter ay halinhinang umiikot (clockwise at counter-clockwise). Kapag ang pointer ay nasa pagitan ng dalawang numero (hal. sa pagitan ng 4 at 5), laging ang mas mababang numero (4) ang opisyal na reading, maliban kung lampas na sa 0.',
    doText: 'Basahin mula kaliwa pakanan (10k, 1k, 100s, 10s, 1s).',
    dontText: 'Huwag mag-round up sa mas mataas na numero kapag di pa lumalampas ang karayom.',
  },
];

const CYCLOMETER_RULE_4: GuideRule = {
  id: 'dials',
  badge: 'Panuntunan 4',
  icon: '🔢',
  title: 'Basahin ang 5 Buong Drum Digits (Huwag Isama ang Pula)',
  tagline: 'Mechanical Drum (Cyclometer): 10,000s hanggang 1s',
  explanation:
    'Sa mechanical drum (cyclometer) meter, basahin ang 5 pangunahing numero mula kaliwa pakanan. Kung may pulang numero sa dulo sa kanan (tenths / decimal roller), huwag itong isama sa buong kWh reading. Kung ang drum ay nasa gitna ng pag-ikot, kunin ang mas mababang numero.',
  doText: 'Kunin lamang ang 5 buong numero (itim/puti) mula kaliwa pakanan.',
  dontText: 'Huwag isama ang pulang decimal digit sa dulo.',
};

export const AnalogPhotographyGuideModal: React.FC<AnalogPhotographyGuideModalProps> = ({
  visible,
  onClose,
  onProceedToCamera,
  initialMeterType = 'dial',
  testID = 'analog-guide-modal',
}) => {
  const { theme, fontScale } = useTheme();
  const [activeStep, setActiveStep] = useState<number>(0);
  const [meterSubtype, setMeterSubtype] = useState<AnalogMeterType>(initialMeterType);

  useEffect(() => {
    if (initialMeterType) {
      setMeterSubtype(initialMeterType);
    }
  }, [initialMeterType]);

  const rules = meterSubtype === 'cyclometer'
    ? [...GUIDE_RULES_DIAL.slice(0, 3), CYCLOMETER_RULE_4]
    : GUIDE_RULES_DIAL;
  const currentRule = rules[activeStep] || rules[0];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} testID={testID}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Header bar */}
        <View style={[styles.header, { borderBottomColor: theme.line }]}>
          <View style={styles.headerTitleGroup}>
            <Text style={[styles.superTitle, { color: theme.brand, fontSize: 12 * fontScale }]}>
              GABAY SA PAGKUHA NG LITRATO
            </Text>
            <Text style={[styles.mainTitle, { color: theme.ink, fontSize: 19 * fontScale }]}>
              Paano Basahin ang Analog Meter
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeIconButton, { backgroundColor: theme.cont }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Isara ang gabay"
          >
            <Text style={[styles.closeIconText, { color: theme.ink }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Subtype Selector: 5-Dial Pointer vs Mechanical Drum (Cyclometer) */}
        <View style={[styles.subtypeRow, { backgroundColor: theme.cont }]}>
          <TouchableOpacity
            testID="guide-subtype-dial"
            style={[
              styles.subtypePill,
              meterSubtype === 'dial' && { backgroundColor: theme.brand },
            ]}
            onPress={() => setMeterSubtype('dial')}
            accessibilityRole="button"
            accessibilityLabel="5-Dial Pointer Meter"
          >
            <Text
              style={[
                styles.subtypePillText,
                {
                  color: meterSubtype === 'dial' ? theme.brandInk : theme.ink,
                  fontSize: 12 * fontScale,
                },
              ]}
            >
              ⏱️ 5-Dial Pointer
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="guide-subtype-cyclometer"
            style={[
              styles.subtypePill,
              meterSubtype === 'cyclometer' && { backgroundColor: theme.brand },
            ]}
            onPress={() => setMeterSubtype('cyclometer')}
            accessibilityRole="button"
            accessibilityLabel="Mechanical Drum Cyclometer Meter"
          >
            <Text
              style={[
                styles.subtypePillText,
                {
                  color: meterSubtype === 'cyclometer' ? theme.brandInk : theme.ink,
                  fontSize: 12 * fontScale,
                },
              ]}
            >
              🔢 Mechanical Drum
            </Text>
          </TouchableOpacity>
        </View>

        {/* Step Indicator Tabs */}
        <View style={styles.stepIndicatorRow}>
          {rules.map((rule, idx) => {
            const isCurrent = idx === activeStep;
            return (
              <TouchableOpacity
                key={rule.id}
                style={[
                  styles.stepTab,
                  {
                    backgroundColor: isCurrent ? theme.brand : theme.cont,
                    borderColor: isCurrent ? theme.brand : theme.line,
                  },
                ]}
                onPress={() => setActiveStep(idx)}
                accessibilityRole="tab"
                accessibilityLabel={`Panuntunan ${idx + 1}: ${rule.title}`}
                accessibilityState={{ selected: isCurrent }}
              >
                <Text
                  style={[
                    styles.stepTabText,
                    {
                      color: isCurrent ? theme.brandInk : theme.muted,
                      fontSize: 12 * fontScale,
                    },
                  ]}
                >
                  {rule.icon} Hakbang {idx + 1}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Scrollable Content */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Card Hero */}
          <View
            style={[
              styles.cardHero,
              {
                backgroundColor: theme.surface,
                borderColor: theme.line,
              },
            ]}
          >
            <View style={styles.badgeRow}>
              <View style={[styles.badgePill, { backgroundColor: theme.brand + '20' }]}>
                <Text style={[styles.badgeText, { color: theme.brand, fontSize: 12 * fontScale }]}>
                  {currentRule.badge}
                </Text>
              </View>
              <Text style={styles.bigHeroIcon}>{currentRule.icon}</Text>
            </View>

            <Text style={[styles.cardTitle, { color: theme.ink, fontSize: 18 * fontScale }]}>
              {currentRule.title}
            </Text>
            <Text style={[styles.cardTagline, { color: theme.muted, fontSize: 13 * fontScale }]}>
              {currentRule.tagline}
            </Text>

            <View style={[styles.divider, { backgroundColor: theme.line }]} />

            <Text style={[styles.explanationText, { color: theme.ink, fontSize: 14 * fontScale }]}>
              {currentRule.explanation}
            </Text>

            {/* Dos and Don'ts */}
            <View style={styles.doDontGroup}>
              <View
                style={[
                  styles.tipBox,
                  {
                    backgroundColor: theme.okBg,
                    borderColor: theme.ok,
                  },
                ]}
              >
                <Text style={[styles.tipTitle, { color: theme.ok, fontSize: 12.5 * fontScale }]}>
                  ✓ TAMA (Gawin Ito):
                </Text>
                <Text style={[styles.tipBody, { color: theme.ink, fontSize: 13 * fontScale }]}>
                  {currentRule.doText}
                </Text>
              </View>

              <View
                style={[
                  styles.tipBox,
                  {
                    backgroundColor: theme.dangerBg,
                    borderColor: theme.danger,
                  },
                ]}
              >
                <Text style={[styles.tipTitle, { color: theme.danger, fontSize: 12.5 * fontScale }]}>
                  ✕ MALI (Iwasan):
                </Text>
                <Text style={[styles.tipBody, { color: theme.ink, fontSize: 13 * fontScale }]}>
                  {currentRule.dontText}
                </Text>
              </View>
            </View>
          </View>

          {/* Dial or Drum Diagram Helper */}
          {activeStep === 3 && (
            <View
              style={[
                styles.diagramBox,
                { backgroundColor: theme.cont, borderColor: theme.line },
              ]}
            >
              <Text style={[styles.diagramHeading, { color: theme.ink, fontSize: 13.5 * fontScale }]}>
                {meterSubtype === 'cyclometer'
                  ? 'Halimbawa ng Mechanical Drum (Cyclometer) Reading:'
                  : 'Halimbawa ng 5-Dial Reading:'}
              </Text>
              <Text style={[styles.diagramSub, { color: theme.muted, fontSize: 12 * fontScale }]}>
                {meterSubtype === 'cyclometer'
                  ? 'Drums: [ 10,000s · 1,000s · 100s · 10s · 1s ] + [ .1 Red Ignore ]'
                  : 'Dials: [ 10,000s · 1,000s · 100s · 10s · 1s ]'}
              </Text>
              <View style={styles.dialExampleRow}>
                {[
                  { label: '10k', dir: meterSubtype === 'cyclometer' ? 'DRUM' : 'CW ↷', val: 1 },
                  { label: '1k', dir: meterSubtype === 'cyclometer' ? 'DRUM' : 'CCW ↶', val: 4 },
                  { label: '100s', dir: meterSubtype === 'cyclometer' ? 'DRUM' : 'CW ↷', val: 2 },
                  { label: '10s', dir: meterSubtype === 'cyclometer' ? 'DRUM' : 'CCW ↶', val: 8 },
                  { label: '1s', dir: meterSubtype === 'cyclometer' ? 'DRUM' : 'CW ↷', val: 5 },
                ].map((d, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dialBubble,
                      { backgroundColor: theme.surface, borderColor: theme.line },
                    ]}
                  >
                    <Text style={[styles.dialVal, { color: theme.brand, fontSize: 17 * fontScale }]}>
                      {d.val}
                    </Text>
                    <Text style={[styles.dialLabel, { color: theme.ink, fontSize: 10 * fontScale }]}>
                      {d.label}
                    </Text>
                    <Text style={[styles.dialDir, { color: theme.muted, fontSize: 9 * fontScale }]}>
                      {d.dir}
                    </Text>
                  </View>
                ))}
              </View>
              <Text
                style={[
                  styles.diagramResult,
                  { color: theme.ok, fontSize: 13 * fontScale },
                ]}
              >
                👉 Resulta: 14,285 kWh
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer controls */}
        <View style={[styles.footer, { borderTopColor: theme.line, backgroundColor: theme.surface }]}>
          <View style={styles.navRow}>
            {activeStep > 0 ? (
              <TouchableOpacity
                style={[styles.backButton, { borderColor: theme.line }]}
                onPress={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                accessibilityRole="button"
                accessibilityLabel="Bumalik sa nakaraang hakbang"
              >
                <Text style={[styles.backButtonText, { color: theme.ink, fontSize: 14 * fontScale }]}>
                  ← Nauna
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {activeStep < rules.length - 1 ? (
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: theme.cont, borderColor: theme.line }]}
                onPress={() => setActiveStep((prev) => Math.min(rules.length - 1, prev + 1))}
                accessibilityRole="button"
                accessibilityLabel="Pumunta sa susunod na hakbang"
              >
                <Text style={[styles.nextButtonText, { color: theme.ink, fontSize: 14 * fontScale }]}>
                  Susunod →
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionCtaButton, { backgroundColor: theme.brand }]}
                onPress={() => {
                  onClose();
                  if (onProceedToCamera) onProceedToCamera(meterSubtype);
                }}
                accessibilityRole="button"
                accessibilityLabel="Simulan ang pagkuha ng litrato"
              >
                <Text
                  style={[
                    styles.actionCtaText,
                    { color: theme.brandInk, fontSize: 15 * fontScale },
                  ]}
                >
                  Kunan Na ng Litrato 📷
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitleGroup: {
    flex: 1,
  },
  superTitle: {
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  mainTitle: {
    fontWeight: '800',
    marginTop: 2,
  },
  closeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeIconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtypeRow: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 10,
    padding: 3,
    borderRadius: 12,
    gap: 6,
  },
  subtypePill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtypePillText: {
    fontWeight: '800',
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  stepTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTabText: {
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cardHero: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 18,
    marginTop: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontWeight: '800',
  },
  bigHeroIcon: {
    fontSize: 28,
  },
  cardTitle: {
    fontWeight: '800',
    marginBottom: 4,
  },
  cardTagline: {
    fontWeight: '600',
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  explanationText: {
    lineHeight: 22,
    fontWeight: '500',
  },
  doDontGroup: {
    marginTop: 16,
    gap: 10,
  },
  tipBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  tipTitle: {
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  tipBody: {
    lineHeight: 18,
    fontWeight: '600',
  },
  diagramBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
    alignItems: 'center',
  },
  diagramHeading: {
    fontWeight: '800',
    marginBottom: 2,
  },
  diagramSub: {
    fontWeight: '600',
    marginBottom: 10,
  },
  dialExampleRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginVertical: 4,
  },
  dialBubble: {
    width: 54,
    height: 64,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialVal: {
    fontWeight: '900',
  },
  dialLabel: {
    fontWeight: '700',
    marginTop: 1,
  },
  dialDir: {
    fontWeight: '600',
  },
  diagramResult: {
    fontWeight: '800',
    marginTop: 10,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  navRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  backButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontWeight: '700',
  },
  nextButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontWeight: '700',
  },
  actionCtaButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCtaText: {
    fontWeight: '800',
  },
});
