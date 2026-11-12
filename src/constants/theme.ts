export type ThemeMode = 'warm' | 'night' | 'contrast';

export interface ColorTheme {
  bg: string;
  surface: string;
  cont: string;
  line: string;
  ink: string;
  muted: string;
  brand: string;
  brandInk: string;
  brandOrange: string;
  brandOrangeRed: string;
  brandGlow: string;
  ok: string;
  okBg: string;
  warn: string;
  warnBg: string;
  danger: string;
  dangerBg: string;
  peak: string;
  peakBg: string;
}

export const THEMES: Record<ThemeMode, ColorTheme> = {
  warm: {
    bg: '#FFFDF9',
    surface: '#FFFDF9',
    cont: '#F4EFE6',
    line: '#E7E1D6',
    ink: '#0F172A',
    muted: '#475569',
    brand: '#FF5500',
    brandInk: '#FFFDF9',
    brandOrange: '#FF6B00',
    brandOrangeRed: '#FF451A',
    brandGlow: '#FF3B1D',
    ok: '#065F46',
    okBg: '#D1FAE5',
    warn: '#92400E',
    warnBg: '#FEF3C7',
    danger: '#991B1B',
    dangerBg: '#FEE2E2',
    peak: '#5B21B6',
    peakBg: '#EDE9FE',
  },
  night: {
    bg: '#121824',
    surface: '#1E2638',
    cont: '#1E2638',
    line: '#334155',
    ink: '#F8FAFC',
    muted: '#94A3B8',
    brand: '#FF6433',
    brandInk: '#121824',
    brandOrange: '#FF7A29',
    brandOrangeRed: '#FF4D26',
    brandGlow: '#FF3B1D',
    ok: '#34D399',
    okBg: '#064E3B',
    warn: '#FBBF24',
    warnBg: '#3A2A08',
    danger: '#F87171',
    dangerBg: '#4C1D1D',
    peak: '#A78BFA',
    peakBg: '#2E1F5C',
  },
  contrast: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    cont: '#FFFFFF',
    line: '#000000',
    ink: '#000000',
    muted: '#000000',
    brand: '#000000',
    brandInk: '#FFD400',
    brandOrange: '#000000',
    brandOrangeRed: '#000000',
    brandGlow: '#000000',
    ok: '#000000',
    okBg: '#FFFFFF',
    warn: '#000000',
    warnBg: '#FFD400',
    danger: '#000000',
    dangerBg: '#FFFFFF',
    peak: '#000000',
    peakBg: '#FFFFFF',
  },
};
