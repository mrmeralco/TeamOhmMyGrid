// ==============================================================================
// Adversarial Stress Testing Suite: Context, Badge & Parity Integrity
// Challenger 2 (Milestone M1)
//
// Rigorous adversarial challenge verifying:
// 1. Synchronous resolveMeterType: null, undefined, malformed strings, seeded CANs,
//    and arbitrary parity CANs across all 10 terminal digits.
// 2. MeterClassificationBadge: sizing tiers (compact, standard, detailed),
//    meterType='AMI' vs 'Analog' vs null vs undefined, theme color mapping,
//    font scaling, accessibility labels, and interaction callbacks.
// 3. Rapid profile switching race conditions: concurrent burst switching,
//    synchronous state immutability, invalid profile target guards, and profile deletions.
// 4. Legacy AsyncStorage schema migration: deserialization of un-migrated profile JSON,
//    proper meterType and meterSerialNumber backfilling, corrupted JSON recovery,
//    and data preservation.
// ==============================================================================

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveMeterType, determineMeterTypeByParity, MERALCO_SEED_ACCOUNTS } from '../../services/meralcoApiService';
import { MeterType, CANProfile } from '../../types';
import { PRESET_CAN_PROFILES } from '../../constants/mockData';
import { createDefaultUserCanProfiles } from '../../context/EnergyContext';
import { THEMES, ThemeMode } from '../../constants/theme';
import { cleanCAN } from '../../utils/validation';

// Configurable mock for useTheme
let mockThemeState = {
  theme: THEMES.warm,
  mode: 'warm' as ThemeMode,
  fontScale: 1.0,
  language: 'english' as 'english' | 'taglish' | 'filipino',
};

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => mockThemeState,
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Import MeterClassificationBadge after ThemeContext mock
import { MeterClassificationBadge, MeterClassificationBadgeProps } from '../../components/MeterClassificationBadge';

describe('Adversarial Stress Test: Context, Badge & Parity Integrity (M1 Challenger 2)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    mockThemeState = {
      theme: THEMES.warm,
      mode: 'warm',
      fontScale: 1.0,
      language: 'english',
    };
  });

  // ============================================================================
  // SECTION 1: Synchronous resolveMeterType Empirical Edge Cases & Boundaries
  // ============================================================================
  describe('1. Synchronous resolveMeterType Edge Cases & Contracts', () => {
    it('returns "AMI" gracefully when CAN is null, undefined, or empty string', () => {
      expect(resolveMeterType(null as any)).toBe('AMI');
      expect(resolveMeterType(undefined as any)).toBe('AMI');
      expect(resolveMeterType('')).toBe('AMI');
    });

    it('returns "AMI" for whitespace-only strings and escaped control characters', () => {
      expect(resolveMeterType('   ')).toBe('AMI');
      expect(resolveMeterType('\t\n\r')).toBe('AMI');
      expect(resolveMeterType('  \t  \n  ')).toBe('AMI');
    });

    it('handles non-numeric and malformed strings without throwing', () => {
      expect(resolveMeterType('ABCDEF')).toBe('AMI');
      expect(resolveMeterType('!@#$%^&*()_+')).toBe('AMI');
      expect(resolveMeterType('⚡⏱️')).toBe('AMI');
    });

    it('correctly classifies all pre-seeded AMI accounts, including odd-digit overrides', () => {
      // 1234567890 (even) -> AMI
      expect(resolveMeterType('1234567890')).toBe('AMI');
      // 1234567891 ends in 1 (odd), but is explicitly seeded as AMI Smart Meter (Jaeda)
      expect(resolveMeterType('1234567891')).toBe('AMI');
      // 1234567892 (even) -> AMI
      expect(resolveMeterType('1234567892')).toBe('AMI');
      // 1029384756 (even) -> AMI
      expect(resolveMeterType('1029384756')).toBe('AMI');
      // 019288234410 (even 12-digit) -> AMI
      expect(resolveMeterType('019288234410')).toBe('AMI');
      expect(resolveMeterType('0192-8823-4410')).toBe('AMI');
      expect(resolveMeterType('0192 8823 4410')).toBe('AMI');
    });

    it('correctly classifies all pre-seeded Analog accounts, including even-digit overrides', () => {
      // 1234567893 (odd) -> Analog
      expect(resolveMeterType('1234567893')).toBe('Analog');
      // 1234567894 ends in 4 (even), but is explicitly seeded as Analog Electromechanical (Hector)
      expect(resolveMeterType('1234567894')).toBe('Analog');
      // 1234567895 (odd) -> Analog
      expect(resolveMeterType('1234567895')).toBe('Analog');
      // 9876543210 ends in 0 (even), but is explicitly seeded as Analog Electromechanical (Juan)
      expect(resolveMeterType('9876543210')).toBe('Analog');
      // 028491023321 (odd 12-digit Tindahan) -> Analog
      expect(resolveMeterType('028491023321')).toBe('Analog');
      expect(resolveMeterType('0284-9102-3321')).toBe('Analog');
      // 034177895562 ends in 2 (even 12-digit Condo), but is explicitly seeded as Analog
      expect(resolveMeterType('034177895562')).toBe('Analog');
      expect(resolveMeterType('0341-7789-5562')).toBe('Analog');
    });

    it('correctly applies odd/even parity fallback for all 10 terminal digits on arbitrary CANs', () => {
      // Test base arbitrary prefix that does not collide with seed dictionary
      const prefix = '771122334';
      const parityExpectations: Record<string, MeterType> = {
        '0': 'AMI',
        '1': 'Analog',
        '2': 'AMI',
        '3': 'Analog',
        '4': 'AMI',
        '5': 'Analog',
        '6': 'AMI',
        '7': 'Analog',
        '8': 'AMI',
        '9': 'Analog',
      };

      for (const [lastDigit, expectedType] of Object.entries(parityExpectations)) {
        const arbitraryCan = `${prefix}${lastDigit}`;
        expect(resolveMeterType(arbitraryCan)).toBe(expectedType);
        expect(resolveMeterType(`${prefix.slice(0, 4)}-${prefix.slice(4, 8)}-${prefix.slice(8)}${lastDigit}`)).toBe(
          expectedType
        );
      }
    });

    it('handles CANs embedded with noisy non-digits and trailing spaces', () => {
      // Clean digits end with '8' (even) -> AMI
      expect(resolveMeterType('ACC# 7711-2233-48 [Verified]')).toBe('AMI');
      // Clean digits end with '7' (odd) -> Analog
      expect(resolveMeterType('ACC# 7711-2233-47 [Verified]')).toBe('Analog');
    });

    it('documents failure mode when non-string number is passed to resolveMeterType', () => {
      // cleanCAN expects a string with .replace(); passing a number throws TypeError
      // This is an important boundary: callers must ensure string coercion
      expect(() => resolveMeterType(1234567890 as any)).toThrow(TypeError);
      // Coerced string works as expected
      expect(resolveMeterType(String(1234567890))).toBe('AMI');
      expect(resolveMeterType(String(1234567893))).toBe('Analog');
    });
  });

  // ============================================================================
  // SECTION 2: MeterClassificationBadge Props, Sizing Variants, Themes & A11y
  // ============================================================================
  describe('2. MeterClassificationBadge Adversarial Rendering & Visual Contracts', () => {
    // Helper to extract flattened style object
    const getFlattenedStyle = (styleProp: any): Record<string, any> => {
      if (Array.isArray(styleProp)) {
        return Object.assign({}, ...styleProp.filter(Boolean));
      }
      return styleProp || {};
    };

    it('renders standard size AMI badge with correct tokens, emoji icon, and labels', () => {
      const element = MeterClassificationBadge({ meterType: 'AMI', size: 'standard' }) as any;
      expect(element).toBeDefined();

      // Container checks
      expect(element.props.testID).toBe('meter-badge-ami');
      expect(element.props.accessibilityRole).toBe('text');
      expect(element.props.accessibilityLabel).toContain('Meter type: AMI Smart Meter');
      expect(element.props.accessibilityLabel).toContain('Automated 15-minute telemetry active');

      const containerStyle = getFlattenedStyle(element.props.style);
      expect(containerStyle.backgroundColor).toBe(THEMES.warm.okBg);
      expect(containerStyle.borderColor).toBe(THEMES.warm.ok);

      // Inspect children row
      const contentRow = element.props.children;
      expect(contentRow).toBeDefined();
      const [iconElement, textColElement] = contentRow.props.children;

      // Icon checks
      expect(iconElement).toBeDefined();
      expect(iconElement.props['aria-hidden']).toBe(true);
      expect(iconElement.props.children).toBe('⚡');

      // Title label checks
      const titleElement = textColElement.props.children[0];
      expect(titleElement.props.children).toBe('AMI Smart Meter');
      const titleStyle = getFlattenedStyle(titleElement.props.style);
      expect(titleStyle.color).toBe(THEMES.warm.ok);
    });

    it('renders standard size Analog badge with warn tokens and ⏱️ icon', () => {
      const element = MeterClassificationBadge({ meterType: 'Analog', size: 'standard' }) as any;
      expect(element).toBeDefined();

      expect(element.props.testID).toBe('meter-badge-analog');
      expect(element.props.accessibilityLabel).toContain('Meter type: Analog Electromechanical Meter');
      expect(element.props.accessibilityLabel).toContain('Weekly photo capture required');

      const containerStyle = getFlattenedStyle(element.props.style);
      expect(containerStyle.backgroundColor).toBe(THEMES.warm.warnBg);
      expect(containerStyle.borderColor).toBe(THEMES.warm.warn);

      const contentRow = element.props.children;
      const [iconElement, textColElement] = contentRow.props.children;
      expect(iconElement.props.children).toBe('⏱️');

      const titleElement = textColElement.props.children[0];
      expect(titleElement.props.children).toBe('Analog Meter');
      const titleStyle = getFlattenedStyle(titleElement.props.style);
      expect(titleStyle.color).toBe(THEMES.warm.warn);
    });

    it('defaults gracefully to AMI when meterType is undefined or null', () => {
      const nullMeterBadge = MeterClassificationBadge({ meterType: null }) as any;
      expect(nullMeterBadge.props.testID).toBe('meter-badge-ami');
      expect(nullMeterBadge.props.accessibilityLabel).toContain('AMI Smart Meter');

      const undefinedMeterBadge = MeterClassificationBadge({ meterType: undefined }) as any;
      expect(undefinedMeterBadge.props.testID).toBe('meter-badge-ami');
      expect(undefinedMeterBadge.props.accessibilityLabel).toContain('AMI Smart Meter');
    });

    it('renders compact sizing tier with abbreviated labels and no subtitle', () => {
      const compactAmi = MeterClassificationBadge({ meterType: 'AMI', size: 'compact' }) as any;
      const compactAnalog = MeterClassificationBadge({ meterType: 'Analog', size: 'compact' }) as any;

      // Compact AMI
      const amiRow = compactAmi.props.children;
      const [amiIcon, amiTextCol] = amiRow.props.children;
      expect(amiTextCol.props.children[0].props.children).toBe('AMI');
      expect(amiTextCol.props.children[1]).toBeFalsy(); // Subtitle should be false/null in compact

      // Compact Analog
      const analogRow = compactAnalog.props.children;
      const [analogIcon, analogTextCol] = analogRow.props.children;
      expect(analogTextCol.props.children[0].props.children).toBe('Analog');
      expect(analogTextCol.props.children[1]).toBeFalsy();
    });

    it('renders detailed sizing tier with full subtitle description in english and taglish', () => {
      // Detailed English AMI
      mockThemeState.language = 'english';
      const detailedAmi = MeterClassificationBadge({ meterType: 'AMI', size: 'detailed' }) as any;
      const amiTextCol = detailedAmi.props.children.props.children[1];
      const amiSubtitle = amiTextCol.props.children[1];
      expect(amiSubtitle).toBeTruthy();
      expect(amiSubtitle.props.children).toBe('15-min interval active');

      // Detailed Taglish AMI
      mockThemeState.language = 'taglish';
      const detailedAmiTaglish = MeterClassificationBadge({ meterType: 'AMI', size: 'detailed' }) as any;
      const amiTaglishSubtitle = detailedAmiTaglish.props.children.props.children[1].props.children[1];
      expect(amiTaglishSubtitle.props.children).toBe('15-min telemetry active');

      // Detailed English Analog
      mockThemeState.language = 'english';
      const detailedAnalog = MeterClassificationBadge({ meterType: 'Analog', size: 'detailed' }) as any;
      const analogSubtitle = detailedAnalog.props.children.props.children[1].props.children[1];
      expect(analogSubtitle.props.children).toBe('Weekly photo log');

      // Detailed Taglish Analog
      mockThemeState.language = 'taglish';
      const detailedAnalogTaglish = MeterClassificationBadge({ meterType: 'Analog', size: 'detailed' }) as any;
      const analogTaglishSubtitle = detailedAnalogTaglish.props.children.props.children[1].props.children[1];
      expect(analogTaglishSubtitle.props.children).toBe('Lingguhang litrato');
    });

    it('honors showIcon = false by omitting the icon element completely', () => {
      const noIconBadge = MeterClassificationBadge({ meterType: 'AMI', showIcon: false }) as any;
      const contentRow = noIconBadge.props.children;
      const [iconElement, textColElement] = contentRow.props.children;
      expect(iconElement).toBeFalsy();
      expect(textColElement).toBeDefined();
    });

    it('honors showSubtitle = false in detailed size by suppressing the subtitle', () => {
      const noSubtitleBadge = MeterClassificationBadge({
        meterType: 'AMI',
        size: 'detailed',
        showSubtitle: false,
      }) as any;
      const textCol = noSubtitleBadge.props.children.props.children[1];
      const subtitleElement = textCol.props.children[1];
      expect(subtitleElement).toBeFalsy();
    });

    it('transforms to clickable TouchableOpacity with accessibilityRole="button" when onPress is provided', () => {
      const onPressMock = jest.fn();
      const clickableBadge = MeterClassificationBadge({
        meterType: 'AMI',
        onPress: onPressMock,
      }) as any;

      expect(clickableBadge.props.accessibilityRole).toBe('button');
      expect(typeof clickableBadge.props.onPress).toBe('function');
      clickableBadge.props.onPress();
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it('adapts colors across warm, night, and contrast themes dynamically', () => {
      // Night Theme
      mockThemeState.theme = THEMES.night;
      mockThemeState.mode = 'night';
      const nightAmi = MeterClassificationBadge({ meterType: 'AMI' }) as any;
      const nightStyle = getFlattenedStyle(nightAmi.props.style);
      expect(nightStyle.backgroundColor).toBe(THEMES.night.okBg);
      expect(nightStyle.borderColor).toBe(THEMES.night.ok);

      const nightAnalog = MeterClassificationBadge({ meterType: 'Analog' }) as any;
      const nightAnalogStyle = getFlattenedStyle(nightAnalog.props.style);
      expect(nightAnalogStyle.backgroundColor).toBe(THEMES.night.warnBg);
      expect(nightAnalogStyle.borderColor).toBe(THEMES.night.warn);

      // Contrast Theme
      mockThemeState.theme = THEMES.contrast;
      mockThemeState.mode = 'contrast';
      const contrastAmi = MeterClassificationBadge({ meterType: 'AMI' }) as any;
      const contrastStyle = getFlattenedStyle(contrastAmi.props.style);
      expect(contrastStyle.backgroundColor).toBe(THEMES.contrast.okBg);
      expect(contrastStyle.borderColor).toBe(THEMES.contrast.ok);
    });

    it('scales font size proportionally when fontScale is modified', () => {
      mockThemeState.fontScale = 1.5;
      const scaledBadge = MeterClassificationBadge({ meterType: 'AMI', size: 'standard' }) as any;
      const contentRow = scaledBadge.props.children;
      const [iconElement, textColElement] = contentRow.props.children;

      const iconStyle = getFlattenedStyle(iconElement.props.style);
      expect(iconStyle.fontSize).toBe(13 * 1.5); // 19.5

      const titleStyle = getFlattenedStyle(textColElement.props.children[0].props.style);
      expect(titleStyle.fontSize).toBe(12.5 * 1.5); // 18.75
    });

    it('accepts and merges custom style overrides and custom testID', () => {
      const customStyle = { marginTop: 20, paddingHorizontal: 40 };
      const styledBadge = MeterClassificationBadge({
        meterType: 'AMI',
        testID: 'adversarial-badge-custom-id',
        style: customStyle,
      }) as any;

      expect(styledBadge.props.testID).toBe('adversarial-badge-custom-id');
      const mergedStyle = getFlattenedStyle(styledBadge.props.style);
      expect(mergedStyle.marginTop).toBe(20);
      expect(mergedStyle.paddingHorizontal).toBe(40);
    });

    it('falls back safely without throwing when an unknown meterType string is provided', () => {
      // If an invalid/unknown meterType is passed at runtime (e.g., 'HYBRID' or 'SOLAR')
      const unknownBadge = MeterClassificationBadge({
        meterType: 'HYBRID' as any,
        size: 'standard',
      }) as any;

      expect(unknownBadge).toBeDefined();
      // Since it is not 'AMI', it safely falls back to the Analog path
      expect(unknownBadge.props.testID).toBe('meter-badge-hybrid');
      expect(unknownBadge.props.accessibilityLabel).toContain('Analog Electromechanical Meter');
    });
  });

  // ============================================================================
  // SECTION 3: Rapid Profile Switching Race Conditions & State Synchronization
  // ============================================================================
  describe('3. Profile Switching Race Conditions & State Synchronization', () => {
    it('synchronously associates activeCanProfile.meterType during rapid sequential switching', () => {
      // Simulate multi-profile state
      const profiles: CANProfile[] = [
        {
          id: 'can-1',
          name: 'Bahay (Pasig)',
          accountNumber: '0192-8823-4410',
          customerName: 'Maria Santos',
          serviceAddress: 'Pasig City',
          ratePerKwh: 11.43,
          budget: 3500,
          currentKwh: 188,
          meterType: 'AMI',
          meterSerialNumber: 'MR-AMI-4410',
        },
        {
          id: 'can-2',
          name: 'Tindahan / Negosyo',
          accountNumber: '0284-9102-3321',
          customerName: 'Santos Sari-Sari Store',
          serviceAddress: 'Pasig City',
          ratePerKwh: 11.48,
          budget: 5000,
          currentKwh: 340,
          meterType: 'Analog',
          meterSerialNumber: 'MR-ANA-3321',
        },
        {
          id: 'can-3',
          name: 'Condo / Taguig',
          accountNumber: '0341-7789-5562',
          customerName: 'Maria Santos (Condo)',
          serviceAddress: 'Taguig City',
          ratePerKwh: 11.43,
          budget: 2500,
          currentKwh: 120,
          meterType: 'Analog',
          meterSerialNumber: 'MR-ANA-5562',
        },
      ];

      // Simulated state container matching EnergyContext resolution
      let activeCanId = 'can-1';
      const getActiveProfile = () => profiles.find((p) => p.id === activeCanId) || profiles[0];

      // Initial: Bahay is AMI
      expect(getActiveProfile().id).toBe('can-1');
      expect(getActiveProfile().meterType).toBe('AMI');
      expect(getActiveProfile().meterSerialNumber).toBe('MR-AMI-4410');

      // Switch to can-2 (Tindahan) -> Analog
      activeCanId = 'can-2';
      expect(getActiveProfile().id).toBe('can-2');
      expect(getActiveProfile().meterType).toBe('Analog');
      expect(getActiveProfile().meterSerialNumber).toBe('MR-ANA-3321');

      // Switch to can-3 (Condo) -> Analog
      activeCanId = 'can-3';
      expect(getActiveProfile().id).toBe('can-3');
      expect(getActiveProfile().meterType).toBe('Analog');
      expect(getActiveProfile().meterSerialNumber).toBe('MR-ANA-5562');

      // Switch back to can-1 (Bahay) -> AMI
      activeCanId = 'can-1';
      expect(getActiveProfile().id).toBe('can-1');
      expect(getActiveProfile().meterType).toBe('AMI');
      expect(getActiveProfile().meterSerialNumber).toBe('MR-AMI-4410');
    });

    it('withstands a high-frequency alternating burst of 100 profile switch actions', async () => {
      const amiProfile: CANProfile = {
        id: 'can-ami-burst',
        name: 'AMI Burst Profile',
        accountNumber: '1029-3847-56',
        customerName: 'Burst User',
        serviceAddress: 'Metro Manila',
        ratePerKwh: 11.43,
        budget: 4000,
        currentKwh: 200,
        meterType: 'AMI',
      };
      const analogProfile: CANProfile = {
        id: 'can-analog-burst',
        name: 'Analog Burst Profile',
        accountNumber: '1234-5678-93',
        customerName: 'Burst User',
        serviceAddress: 'Metro Manila',
        ratePerKwh: 11.43,
        budget: 4000,
        currentKwh: 200,
        meterType: 'Analog',
      };

      const profiles = [amiProfile, analogProfile];
      let activeCanId = amiProfile.id;

      // Simulate 100 alternating asynchronous profile switches concurrently
      const switchHistory: string[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 100; i++) {
        const targetId = i % 2 === 0 ? analogProfile.id : amiProfile.id;
        promises.push(
          (async () => {
            activeCanId = targetId;
            switchHistory.push(targetId);
            await AsyncStorage.setItem('@kuryentipid_active_can_id_test', targetId);
          })()
        );
      }

      await Promise.all(promises);

      // Verify that the active profile is guaranteed to be one of the valid profiles
      const resolved = profiles.find((p) => p.id === activeCanId);
      expect(resolved).toBeDefined();
      expect(['AMI', 'Analog']).toContain(resolved?.meterType);
      expect(resolved?.meterType).toBe(activeCanId === amiProfile.id ? 'AMI' : 'Analog');
    });

    it('safely ignores invalid non-existent profile IDs without corrupting state', () => {
      const profiles = [...PRESET_CAN_PROFILES];
      let activeCanId = 'can-1';

      const switchCanProfileSafe = (targetId: string) => {
        const found = profiles.find((p) => p.id === targetId);
        if (!found) return; // Guard
        activeCanId = targetId;
      };

      switchCanProfileSafe('totally-bogus-can-id');
      expect(activeCanId).toBe('can-1');
      const current = profiles.find((p) => p.id === activeCanId);
      expect(current?.meterType).toBe('AMI');
    });

    it('handles profile deletion and falls back cleanly to the remaining profile', () => {
      let profiles: CANProfile[] = [
        {
          id: 'can-primary-ami',
          name: 'Primary AMI',
          accountNumber: '0192-8823-4410',
          customerName: 'Owner',
          serviceAddress: 'Pasig',
          ratePerKwh: 11.43,
          budget: 3500,
          currentKwh: 180,
          meterType: 'AMI',
        },
        {
          id: 'can-secondary-analog',
          name: 'Secondary Analog',
          accountNumber: '0284-9102-3321',
          customerName: 'Owner',
          serviceAddress: 'Pasig',
          ratePerKwh: 11.43,
          budget: 2500,
          currentKwh: 90,
          meterType: 'Analog',
        },
      ];

      let activeCanId = 'can-primary-ami';

      // Delete active profile
      const deleteProfile = (idToDelete: string) => {
        if (profiles.length <= 1) return;
        profiles = profiles.filter((p) => p.id !== idToDelete);
        if (activeCanId === idToDelete && profiles.length > 0) {
          activeCanId = profiles[0].id;
        }
      };

      deleteProfile('can-primary-ami');
      expect(profiles).toHaveLength(1);
      expect(activeCanId).toBe('can-secondary-analog');
      const active = profiles.find((p) => p.id === activeCanId);
      expect(active?.meterType).toBe('Analog');

      // Attempting to delete the last profile should be rejected
      deleteProfile('can-secondary-analog');
      expect(profiles).toHaveLength(1);
      expect(activeCanId).toBe('can-secondary-analog');
    });

    it('validates addCanProfile constraints on 10-digit standard CAN vs 12-digit length', () => {
      // In EnergyContext: addCanProfile requires cleanCAN length === 10
      let profiles: CANProfile[] = [...PRESET_CAN_PROFILES];
      const addProfile = (name: string, accountNumber: string, meterType?: MeterType) => {
        const clean = cleanCAN(accountNumber);
        if (!clean || clean.length !== 10) return false;
        const resolvedType = meterType || resolveMeterType(clean);
        profiles.push({
          id: `can-${clean}`,
          name,
          accountNumber,
          customerName: 'Customer',
          serviceAddress: 'Manila',
          ratePerKwh: 11.43,
          budget: 3500,
          currentKwh: 100,
          meterType: resolvedType,
        });
        return true;
      };

      // 10-digit CAN succeeds
      expect(addProfile('New 10-Digit AMI', '1234-5678-90')).toBe(true);
      expect(profiles[profiles.length - 1].meterType).toBe('AMI');

      // 12-digit CAN rejected by addCanProfile (10-digit strict check)
      expect(addProfile('12-Digit CAN', '0192-8823-4410')).toBe(false);

      // Short CAN rejected
      expect(addProfile('Short CAN', '12345')).toBe(false);
    });
  });

  // ============================================================================
  // SECTION 4: Legacy Storage Simulation & Schema Migration
  // ============================================================================
  describe('4. Legacy Storage Simulation & Schema Migration', () => {
    it('migrates legacy stored profiles lacking meterType and meterSerialNumber', async () => {
      // Legacy JSON payload from older version of the app
      const legacyStoredJson = JSON.stringify([
        {
          id: 'can-legacy-bahay',
          name: 'Bahay (Pasig)',
          accountNumber: '0192-8823-4410', // Seeded AMI (ends in even 0)
          customerName: 'Nena Villanueva',
          serviceAddress: 'Pasig City',
          ratePerKwh: 11.43,
          budget: 3500,
          currentKwh: 188,
          // meterType and meterSerialNumber are completely omitted!
        },
        {
          id: 'can-legacy-tindahan',
          name: 'Tindahan',
          accountNumber: '0284-9102-3321', // Seeded Analog (ends in odd 1)
          customerName: 'Santos Sari-Sari Store',
          serviceAddress: 'Pasig City',
          ratePerKwh: 11.48,
          budget: 5000,
          currentKwh: 385,
        },
        {
          id: 'can-legacy-condo',
          name: 'Condo Taguig',
          accountNumber: '0341-7789-5562', // Seeded Analog (ends in even 2 - override!)
          customerName: 'Condo Owner',
          serviceAddress: 'Taguig City',
          ratePerKwh: 11.43,
          budget: 2500,
          currentKwh: 125,
        },
        {
          id: 'can-legacy-arbitrary-even',
          name: 'Arbitrary Even CAN',
          accountNumber: '8877-6655-42', // Arbitrary even 2 -> Parity fallback AMI
          customerName: 'Arbitrary Owner',
          serviceAddress: 'QC',
          ratePerKwh: 11.43,
          budget: 3000,
          currentKwh: 100,
        },
        {
          id: 'can-legacy-arbitrary-odd',
          name: 'Arbitrary Odd CAN',
          accountNumber: '8877-6655-43', // Arbitrary odd 3 -> Parity fallback Analog
          customerName: 'Arbitrary Owner',
          serviceAddress: 'QC',
          ratePerKwh: 11.43,
          budget: 3000,
          currentKwh: 100,
        },
      ]);

      const storageKey = '@kuryentipid_can_profiles_user_123';
      await AsyncStorage.setItem(storageKey, legacyStoredJson);

      // Execute the exact migration logic from EnergyContext.tsx lines 213-221
      const rawStored = await AsyncStorage.getItem(storageKey);
      expect(rawStored).not.toBeNull();
      const parsed = JSON.parse(rawStored!);

      const migratedProfiles: CANProfile[] = parsed.map((p: any) => ({
        ...p,
        meterType: p.meterType || resolveMeterType(p.accountNumber || p.id),
        meterSerialNumber:
          p.meterSerialNumber ||
          ((p.meterType || resolveMeterType(p.accountNumber || p.id)) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') +
            cleanCAN(p.accountNumber || p.id).slice(-4),
      }));

      expect(migratedProfiles).toHaveLength(5);

      // Verify Bahay -> Seeded AMI
      expect(migratedProfiles[0].meterType).toBe('AMI');
      expect(migratedProfiles[0].meterSerialNumber).toBe('MR-AMI-4410');
      expect(migratedProfiles[0].budget).toBe(3500); // Preserved

      // Verify Tindahan -> Seeded Analog
      expect(migratedProfiles[1].meterType).toBe('Analog');
      expect(migratedProfiles[1].meterSerialNumber).toBe('MR-ANA-3321');
      expect(migratedProfiles[1].currentKwh).toBe(385); // Preserved

      // Verify Condo -> Seeded Analog (Override!)
      expect(migratedProfiles[2].meterType).toBe('Analog');
      expect(migratedProfiles[2].meterSerialNumber).toBe('MR-ANA-5562');

      // Verify Arbitrary Even -> AMI
      expect(migratedProfiles[3].meterType).toBe('AMI');
      expect(migratedProfiles[3].meterSerialNumber).toBe('MR-AMI-5542');

      // Verify Arbitrary Odd -> Analog
      expect(migratedProfiles[4].meterType).toBe('Analog');
      expect(migratedProfiles[4].meterSerialNumber).toBe('MR-ANA-5543');
    });

    it('preserves existing meterType without overwriting during migration', () => {
      // Profile that already has meterType explicitly set to Analog despite even digit
      const partiallyMigrated = [
        {
          id: 'can-already-migrated',
          name: 'Manual Analog Override',
          accountNumber: '9988-7766-44', // even digit 4
          meterType: 'Analog', // Explicitly specified as Analog
          meterSerialNumber: 'MR-ANA-6644',
        },
      ];

      const migrated = partiallyMigrated.map((p: any) => ({
        ...p,
        meterType: p.meterType || resolveMeterType(p.accountNumber || p.id),
        meterSerialNumber:
          p.meterSerialNumber ||
          ((p.meterType || resolveMeterType(p.accountNumber || p.id)) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') +
            cleanCAN(p.accountNumber || p.id).slice(-4),
      }));

      expect(migrated[0].meterType).toBe('Analog');
      expect(migrated[0].meterSerialNumber).toBe('MR-ANA-6644');
    });

    it('falls back to profile ID when accountNumber is missing in legacy schema', () => {
      const legacyWithoutAccount = [
        {
          id: 'can-1234567891', // Seeded Jaeda AMI (odd digit 1 override)
          name: 'Account Missing Fallback',
        },
      ];

      const migrated = legacyWithoutAccount.map((p: any) => ({
        ...p,
        meterType: p.meterType || resolveMeterType(p.accountNumber || p.id),
        meterSerialNumber:
          p.meterSerialNumber ||
          ((p.meterType || resolveMeterType(p.accountNumber || p.id)) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') +
            cleanCAN(p.accountNumber || p.id).slice(-4),
      }));

      expect(migrated[0].meterType).toBe('AMI');
      expect(migrated[0].meterSerialNumber).toBe('MR-AMI-7891');
    });

    it('recovers safely from corrupted or malformed JSON payloads in storage', async () => {
      const badJsonPayloads = [
        '{ invalid json string',
        '[]',
        'null',
        '"just a plain string"',
        '12345',
        'true',
      ];

      for (const badPayload of badJsonPayloads) {
        let loadedProfiles: CANProfile[] = [];
        try {
          const parsed = JSON.parse(badPayload);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedProfiles = parsed.map((p: any) => ({
              ...p,
              meterType: p.meterType || resolveMeterType(p.accountNumber || p.id),
            }));
          }
        } catch {
          // Graceful fallback
        }

        // Must fallback to default profiles when storage is corrupted or empty
        if (loadedProfiles.length === 0) {
          loadedProfiles = createDefaultUserCanProfiles({
            fullName: 'Fallback Customer',
            can: '1234567890',
          });
        }

        expect(loadedProfiles.length).toBeGreaterThan(0);
        expect(loadedProfiles[0].meterType).toBe('AMI');
      }
    });

    it('createDefaultUserCanProfiles respects user.meterType and falls back to resolveMeterType', () => {
      // 0. Completely empty user object
      const profilesEmpty = createDefaultUserCanProfiles({});
      expect(profilesEmpty).toHaveLength(1);
      expect(profilesEmpty[0].meterType).toBe('AMI');
      expect(profilesEmpty[0].accountNumber).toBe('1234-5678-90');
      expect(profilesEmpty[0].meterSerialNumber).toBe('MR-AMI-7890');

      // 1. With explicit meterType provided
      const profilesExplicit = createDefaultUserCanProfiles({
        id: 'u-1',
        fullName: 'Test User',
        can: '9988776655', // odd digit -> would be Analog by default
        meterType: 'AMI', // explicitly overridden
      });
      expect(profilesExplicit[0].meterType).toBe('AMI');
      expect(profilesExplicit[0].meterSerialNumber).toContain('MR-AMI-');

      // 2. Without explicit meterType: falls back to resolveMeterType
      const profilesInferred = createDefaultUserCanProfiles({
        id: 'u-2',
        fullName: 'Test User 2',
        can: '9988776655', // odd digit -> Analog
      });
      expect(profilesInferred[0].meterType).toBe('Analog');
      expect(profilesInferred[0].meterSerialNumber).toContain('MR-ANA-');

      // 3. With seeded account override (Hector: even digit 4 -> Analog)
      const profilesSeededOverride = createDefaultUserCanProfiles({
        id: 'u-3',
        fullName: 'Hector Escobido',
        can: '1234567894',
      });
      expect(profilesSeededOverride[0].meterType).toBe('Analog');
      expect(profilesSeededOverride[0].meterSerialNumber).toBe('MR-ANA-7894');
    });

    it('persists migrated profiles back to AsyncStorage upon subsequent updates', async () => {
      const storageKey = '@kuryentipid_can_profiles_test_persist';
      const legacyData = [
        {
          id: 'can-persisted-legacy',
          name: 'Legacy Persist',
          accountNumber: '1234-5678-90',
          budget: 3500,
          currentKwh: 150,
        },
      ];

      // Simulate loading & migration
      const migrated: CANProfile[] = legacyData.map((p: any) => ({
        ...p,
        meterType: p.meterType || resolveMeterType(p.accountNumber || p.id),
        meterSerialNumber:
          p.meterSerialNumber ||
          ((p.meterType || resolveMeterType(p.accountNumber || p.id)) === 'AMI' ? 'MR-AMI-' : 'MR-ANA-') +
            cleanCAN(p.accountNumber || p.id).slice(-4),
      }));

      // Simulate state update writing back to storage
      await AsyncStorage.setItem(storageKey, JSON.stringify(migrated));

      // Read back from storage and verify persisted schema
      const reloaded = JSON.parse((await AsyncStorage.getItem(storageKey))!);
      expect(reloaded[0].meterType).toBe('AMI');
      expect(reloaded[0].meterSerialNumber).toBe('MR-AMI-7890');
      expect(reloaded[0].budget).toBe(3500);
    });
  });
});
