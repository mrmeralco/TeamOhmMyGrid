import React, { useState } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  Modal,
  StyleSheet,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { ThemeMode } from '../constants/theme';
import { AppLanguage } from '../types';

export const HeaderSettingsButton: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { theme, mode, setMode, fontScale, setFontScale, language, setLanguage } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const triggerHaptic = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // non-blocking
    }
  };

  const handleToggle = () => {
    triggerHaptic();
    setIsOpen(!isOpen);
  };

  const handleSelectTheme = (newMode: ThemeMode) => {
    triggerHaptic();
    setMode(newMode);
  };

  const handleSelectFontScale = (scale: number) => {
    triggerHaptic();
    setFontScale(scale);
  };

  const handleSelectLanguage = (lang: AppLanguage) => {
    triggerHaptic();
    setLanguage(lang);
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: theme.surface,
            borderColor: theme.line,
            shadowColor: theme.ink,
          },
        ]}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel="Mga Setting ng Tema, Laki ng Teksto, at Wika"
        activeOpacity={0.7}
      >
        {/* Gear / Sliders Icon */}
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Circle
            cx="12"
            cy="12"
            r="3"
            stroke={theme.ink}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
            stroke={theme.ink}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={[
            styles.modalOverlay,
            { paddingTop: insets.top + (Platform.OS === 'ios' ? 52 : 56) },
          ]}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <Pressable
            style={[
              styles.dropdownCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.line,
                shadowColor: theme.ink,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={[styles.headerRow, { borderBottomColor: theme.line }]}>
              <View style={styles.headerLeft}>
                <Text style={[styles.dropdownTitle, { color: theme.ink, fontSize: 16 * fontScale }]}>
                  ⚙️ Mga Setting
                </Text>
                <Text style={[styles.dropdownSubtitle, { color: theme.muted, fontSize: 11 * fontScale }]}>
                  Tema, Laki ng Teksto, at Wika
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={[styles.closeBtn, { backgroundColor: theme.cont }]}
                accessibilityLabel="Isara ang mga setting"
              >
                <Text style={[styles.closeBtnText, { color: theme.ink, fontSize: 14 * fontScale }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>

            {/* Section 1: Tema */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionHeading, { color: theme.ink, fontSize: 13 * fontScale }]}>
                🎨 Tema (Theme)
              </Text>
              <View style={styles.optionRow}>
                {[
                  { id: 'warm', label: 'Warm Paper' },
                  { id: 'night', label: 'Night' },
                  { id: 'contrast', label: 'Contrast' },
                ].map((t) => {
                  const isSelected = mode === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.optionPill,
                        {
                          backgroundColor: isSelected ? theme.brand : theme.cont,
                          borderColor: isSelected ? theme.brand : theme.line,
                        },
                      ]}
                      onPress={() => handleSelectTheme(t.id as ThemeMode)}
                    >
                      <Text
                        style={[
                          styles.optionPillText,
                          {
                            color: isSelected ? theme.brandInk : theme.ink,
                            fontSize: 12 * fontScale,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section 2: Laki ng Teksto */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionHeading, { color: theme.ink, fontSize: 13 * fontScale }]}>
                🔤 Laki ng Teksto (Font Size)
              </Text>
              <View style={styles.optionRow}>
                {[
                  { scale: 1.0, label: '1.0x (Karaniwan)' },
                  { scale: 1.15, label: '1.15x' },
                  { scale: 1.3, label: '1.30x (Malaki)' },
                ].map((s) => {
                  const isSelected = fontScale === s.scale;
                  return (
                    <TouchableOpacity
                      key={s.scale}
                      style={[
                        styles.optionPill,
                        {
                          backgroundColor: isSelected ? theme.brand : theme.cont,
                          borderColor: isSelected ? theme.brand : theme.line,
                        },
                      ]}
                      onPress={() => handleSelectFontScale(s.scale)}
                    >
                      <Text
                        style={[
                          styles.optionPillText,
                          {
                            color: isSelected ? theme.brandInk : theme.ink,
                            fontSize: 12 * fontScale,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section 3: Wika */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionHeading, { color: theme.ink, fontSize: 13 * fontScale }]}>
                🌐 Wika (Language)
              </Text>
              <View style={styles.optionRow}>
                {[
                  { id: 'taglish', label: 'Taglish' },
                  { id: 'filipino', label: 'Filipino' },
                  { id: 'english', label: 'English' },
                ].map((lang) => {
                  const isSelected = language === lang.id;
                  return (
                    <TouchableOpacity
                      key={lang.id}
                      style={[
                        styles.optionPill,
                        {
                          backgroundColor: isSelected ? theme.brand : theme.cont,
                          borderColor: isSelected ? theme.brand : theme.line,
                        },
                      ]}
                      onPress={() => handleSelectLanguage(lang.id as AppLanguage)}
                    >
                      <Text
                        style={[
                          styles.optionPillText,
                          {
                            color: isSelected ? theme.brandInk : theme.ink,
                            fontSize: 12 * fontScale,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  dropdownCard: {
    width: 320,
    maxWidth: '92%',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  dropdownTitle: {
    fontWeight: '800',
  },
  dropdownSubtitle: {
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  closeBtnText: {
    fontWeight: '700',
    lineHeight: 16,
  },
  sectionWrap: {
    marginBottom: 12,
  },
  sectionHeading: {
    fontWeight: '700',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  optionPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionPillText: {
    textAlign: 'center',
  },
});
