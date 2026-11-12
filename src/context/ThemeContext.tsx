import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ColorTheme, THEMES, ThemeMode } from '../constants/theme';
import { AppLanguage } from '../types';

interface ThemeContextValue {
  theme: ColorTheme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  fontScale: number;
  setFontScale: (s: number) => void;
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
}

const THEME_STORAGE_KEY = '@kuryentipid_theme_mode';
const FONT_STORAGE_KEY = '@kuryentipid_font_scale';
const LANG_STORAGE_KEY = '@kuryentipid_language';

export const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES.warm,
  mode: 'warm',
  setMode: () => {},
  fontScale: 1.0,
  setFontScale: () => {},
  language: 'taglish',
  setLanguage: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('warm');
  const [fontScale, setFontScaleState] = useState<number>(1.0);
  const [language, setLanguageState] = useState<AppLanguage>('taglish');

  useEffect(() => {
    (async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && (savedMode === 'warm' || savedMode === 'night' || savedMode === 'contrast')) {
          setModeState(savedMode as ThemeMode);
        }
        const savedScale = await AsyncStorage.getItem(FONT_STORAGE_KEY);
        if (savedScale) {
          const parsed = parseFloat(savedScale);
          if (!isNaN(parsed)) setFontScaleState(parsed);
        }
        const savedLang = await AsyncStorage.getItem(LANG_STORAGE_KEY);
        if (savedLang && (savedLang === 'taglish' || savedLang === 'filipino' || savedLang === 'english')) {
          setLanguageState(savedLang as AppLanguage);
        }
      } catch {
        // ignore load error
      }
    })();
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch(() => {});
  };

  const setFontScale = (scale: number) => {
    setFontScaleState(scale);
    AsyncStorage.setItem(FONT_STORAGE_KEY, scale.toString()).catch(() => {});
  };

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANG_STORAGE_KEY, lang).catch(() => {});
  };

  const theme = THEMES[mode] || THEMES.warm;

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, fontScale, setFontScale, language, setLanguage }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
