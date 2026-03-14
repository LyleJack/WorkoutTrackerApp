// ─── Design tokens ─────────────────────────────────────────────────────────────
// All colour values live here. Import `useTheme()` to get the current palette.

import { createContext, useContext } from 'react';

// ── Palettes ──────────────────────────────────────────────────────────────────

export interface ThemePalette {
  bg:         string;
  bgCard:     string;
  bgSheet:    string;
  bgInput:    string;
  border:     string;
  borderMid:  string;
  borderSheet:string;
  purple:     string;
  purpleDim:  string;
  purpleBg:   string;
  purpleDark: string;
  green:      string;
  greenDim:   string;
  greenBg:    string;
  greenBorder:string;
  orange:     string;
  blue:       string;
  red:        string;
  redDim:     string;
  redDark:    string;
  textPrimary:   string;
  textSecondary: string;
  textMuted:     string;
  textFaint:     string;
  textDead:      string;
  white:         string;
  tabBg:      string;
  tabBorder:  string;
  tabActive:  string;
  tabInactive:string;
  isDark: boolean;
}

export const darkPalette: ThemePalette = {
  bg:         '#000000',
  bgCard:     '#0a0a0a',
  bgSheet:    '#09090f',
  bgInput:    '#000000',
  border:     '#111111',
  borderMid:  '#1a1a2a',
  borderSheet:'#1a1a28',
  purple:     '#6C63FF',
  purpleDim:  '#6C63FF22',
  purpleBg:   '#0d0d1f',
  purpleDark: '#110d1f',
  green:      '#22c55e',
  greenDim:   '#22c55e18',
  greenBg:    '#0d1f12',
  greenBorder:'#1a3a22',
  orange:     '#f59e0b',
  blue:       '#3b82f6',
  red:        '#ef4444',
  redDim:     '#ef444466',
  redDark:    '#dc2626',
  textPrimary:   '#e8e8ff',
  textSecondary: '#aaaaaa',
  textMuted:     '#555555',
  textFaint:     '#333333',
  textDead:      '#1e1e1e',
  white:         '#ffffff',
  tabBg:      '#000000',
  tabBorder:  '#111111',
  tabActive:  '#6C63FF',
  tabInactive:'#333333',
  isDark: true,
};

export const lightPalette: ThemePalette = {
  bg:         '#f4f4f8',
  bgCard:     '#ffffff',
  bgSheet:    '#f0f0f6',
  bgInput:    '#f8f8fc',
  border:     '#e0e0e8',
  borderMid:  '#d0d0de',
  borderSheet:'#d8d8e8',
  purple:     '#5a52e8',
  purpleDim:  '#5a52e822',
  purpleBg:   '#ededff',
  purpleDark: '#dddcff',
  green:      '#16a34a',
  greenDim:   '#16a34a18',
  greenBg:    '#f0fdf4',
  greenBorder:'#bbf7d0',
  orange:     '#d97706',
  blue:       '#2563eb',
  red:        '#dc2626',
  redDim:     '#dc262622',
  redDark:    '#b91c1c',
  textPrimary:   '#0f0f1a',
  textSecondary: '#444455',
  textMuted:     '#666677',
  textFaint:     '#999aaa',
  textDead:      '#ccccdd',
  white:         '#ffffff',
  tabBg:      '#ffffff',
  tabBorder:  '#e0e0e8',
  tabActive:  '#5a52e8',
  tabInactive:'#999aaa',
  isDark: false,
};

// ── Context ───────────────────────────────────────────────────────────────────

export const ThemeContext = createContext<ThemePalette>(darkPalette);

export function useTheme(): ThemePalette {
  return useContext(ThemeContext);
}

// Context for live theme switching (callback exposed by RootLayout)
export type ThemeMode = 'dark' | 'light' | 'device';
export const ThemeUpdateContext = createContext<(mode: ThemeMode) => void>(() => {});

// ── Static export for components that don't use hooks (StyleSheet.create outside render) ──
// Screens use useTheme() for dynamic colour; this is for static fallback/initial values.
export const C = darkPalette;

export const FONT = {
  xs:    10,
  sm:    11,
  base:  13,
  md:    14,
  lg:    15,
  xl:    16,
  '2xl': 18,
  '3xl': 22,
  '4xl': 26,
} as const;

export const RADIUS = {
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  '2xl': 28,
} as const;
