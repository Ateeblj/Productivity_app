/**
 * Mobile UI tokens — aligned with polished web glass palette
 * BG #09090f, violet primary, glass surfaces, pill nav
 */
export const mobile = {
  bg: '#09090f',
  bgDeep: '#050508',
  surface: 'rgba(255,255,255,0.04)',
  surfaceHi: 'rgba(255,255,255,0.08)',
  border: 'rgba(255,255,255,0.08)',
  primary: '#a78bfa',
  primaryDim: 'rgba(124,58,237,0.18)',
  primaryGlow: 'rgba(124,58,237,0.45)',
  mint: '#34d399',
  mintDim: 'rgba(52,211,153,0.13)',
  amber: '#fbbf24',
  amberDim: 'rgba(251,191,36,0.09)',
  red: '#f87171',
  t1: '#e8e8f0',
  t2: 'rgba(232,232,240,0.65)',
  t3: 'rgba(232,232,240,0.38)',
  pillBg: 'rgba(14,14,20,0.96)',
  cardRadius: 20,
  pillRadius: 100,
  tabBarHeight: 62,
  fabSize: 54,
} as const;

export type MobileTheme = typeof mobile;
