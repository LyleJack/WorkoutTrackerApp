// ─── Design tokens ────────────────────────────────────────────────────────────
// Single source of truth for every colour and spacing value used in the app.
// Import from here — never hard-code hex strings in component files.

export const C = {
  // Backgrounds
  bg:         '#000000',
  bgCard:     '#0a0a0a',
  bgSheet:    '#09090f',
  bgInput:    '#000000',

  // Borders
  border:     '#111111',
  borderMid:  '#1a1a2a',
  borderSheet:'#1a1a28',

  // Brand
  purple:     '#6C63FF',
  purpleDim:  '#6C63FF22',
  purpleBg:   '#0d0d1f',
  purpleDark: '#110d1f',

  // Success / cardio
  green:      '#22c55e',
  greenDim:   '#22c55e18',
  greenBg:    '#0d1f12',
  greenBorder:'#1a3a22',

  // Accents
  orange:     '#f59e0b',
  blue:       '#3b82f6',
  red:        '#ef4444',
  redDim:     '#ef444466',
  redDark:    '#dc2626',

  // Text
  textPrimary:   '#e8e8ff',
  textSecondary: '#aaaaaa',
  textMuted:     '#555555',
  textFaint:     '#333333',
  textDead:      '#1e1e1e',
  white:         '#ffffff',

  // Tab bar / status bar
  tabBg:      '#000000',
  tabBorder:  '#111111',
  tabActive:  '#6C63FF',
  tabInactive:'#333333',
} as const;

export const FONT = {
  xs:   10,
  sm:   11,
  base: 13,
  md:   14,
  lg:   15,
  xl:   16,
  '2xl':18,
  '3xl':22,
  '4xl':26,
} as const;

export const RADIUS = {
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  '2xl': 28,
} as const;
