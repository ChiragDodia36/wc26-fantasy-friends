/**
 * Design tokens — vibrant dark theme with purple/indigo base + neon accents.
 * Inspired by modern fantasy sports apps and Gen-Z aesthetics.
 */
import type { ColorValue } from 'react-native';

type GradientPair = [string, string];

export const Colors = {
  // Backgrounds — deep purple/indigo base
  bg: '#0B0D1F',
  bgCard: 'rgba(22,20,50,0.7)',
  bgCardSolid: '#151335',
  bgElevated: 'rgba(30,28,65,0.85)',
  bgOverlay: 'rgba(0,0,0,0.7)',

  // Glass borders — purple-tinted
  glassBorder: 'rgba(120,100,255,0.12)',
  glassBorderFocus: 'rgba(0,212,255,0.4)',

  // Primary accent — electric cyan
  accent: '#00D4FF',
  accentDark: '#0099CC',
  accentMuted: 'rgba(0,212,255,0.15)',

  // Secondary — neon lime
  lime: '#4FFFB0',
  limeMuted: 'rgba(79,255,176,0.15)',

  // Tertiary — hot pink/magenta
  pink: '#FF6BCA',
  pinkMuted: 'rgba(255,107,202,0.15)',

  // Gold — kept for premium elements
  gold: '#FFD166',
  goldDark: '#E6B84D',
  goldMuted: 'rgba(255,209,102,0.15)',

  // Text — lighter for contrast on purple
  textPrimary: '#F0EEFF',
  textSecondary: '#B8B2D9',
  textMuted: '#7E78A0',
  textDim: '#4E4870',

  // Position colors — more vibrant
  posGK: '#FFD166',
  posDEF: '#00D4FF',
  posMID: '#4FFFB0',
  posFWD: '#FF6BCA',

  // Status
  live: '#FF3B5C',
  liveBg: 'rgba(255,59,92,0.15)',
  success: '#4FFFB0',
  successBg: 'rgba(79,255,176,0.12)',
  error: '#FF5F7E',
  errorBg: 'rgba(255,95,126,0.12)',
  warning: '#FFB443',
  warningBg: 'rgba(255,180,67,0.12)',
  purple: '#B388FF',
  purpleBg: 'rgba(179,136,255,0.15)',

  // AI
  aiBg: 'rgba(0,212,255,0.08)',
  aiBorder: 'rgba(0,212,255,0.2)',
} as const;

export const Gradients: Record<string, GradientPair> = {
  // Primary CTA — cyan to blue
  primaryCta: ['#00D4FF', '#6C5CE7'],
  // Secondary CTA — lime to cyan
  secondaryCta: ['#4FFFB0', '#00D4FF'],
  // Gold accent
  goldCta: ['#FFD166', '#E6994D'],

  // Cards — purple glass
  card: ['rgba(22,20,50,0.75)', 'rgba(15,13,40,0.9)'],
  cardElevated: ['rgba(35,30,75,0.8)', 'rgba(22,20,50,0.9)'],
  cardGold: ['rgba(255,209,102,0.1)', 'rgba(230,153,77,0.05)'],
  cardAi: ['rgba(0,212,255,0.1)', 'rgba(108,92,231,0.05)'],
  cardLive: ['rgba(255,59,92,0.12)', 'rgba(255,59,92,0.03)'],
  cardError: ['rgba(255,95,126,0.1)', 'rgba(255,95,126,0.03)'],

  // Stat chips
  statBlue: ['rgba(0,212,255,0.18)', 'rgba(0,212,255,0.06)'],
  statGreen: ['rgba(79,255,176,0.18)', 'rgba(79,255,176,0.06)'],
  statGold: ['rgba(255,209,102,0.18)', 'rgba(255,209,102,0.06)'],

  // Tab bar
  tabBar: ['rgba(11,13,31,0.95)', 'rgba(11,13,31,0.85)'],

  // Pills
  pillActive: ['#00D4FF', '#6C5CE7'],
};

export const Shadows = {
  card: {
    shadowColor: '#6C5CE7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  goldGlow: {
    shadowColor: '#FFD166',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  subtle: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const Typography = {
  hero: { fontSize: 30, fontWeight: '800' as const, color: Colors.textPrimary },
  screenTitle: { fontSize: 24, fontWeight: '700' as const, color: Colors.textPrimary },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
  },
  statValue: { fontSize: 18, fontWeight: '800' as const, color: Colors.accent },
  body: { fontSize: 14, color: Colors.textSecondary },
  caption: {
    fontSize: 10,
    textTransform: 'uppercase' as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 24,
} as const;

export const Animation = {
  pressScale: 0.96,
  spring: { damping: 14, stiffness: 170 },
} as const;

export const POS_COLORS: Record<string, string> = {
  GK: Colors.posGK,
  DEF: Colors.posDEF,
  MID: Colors.posMID,
  FWD: Colors.posFWD,
};
