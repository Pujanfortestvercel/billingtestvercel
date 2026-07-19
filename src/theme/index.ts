// ---------------------------------------------------------------------------
// THEME — the single place we import styling tokens from.
// Usage anywhere:  import { colors, spacing, fontSize, radius } from '../theme';
// ---------------------------------------------------------------------------

export { colors } from './colors';

// SPACING — consistent gaps & padding. We use a small fixed set of sizes
// (a "spacing scale") so the whole app feels evenly spaced.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// RADIUS — how rounded corners are.
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999, // fully rounded (for badges/chips)
} as const;

// FONT SIZES — a fixed type scale.
export const fontSize = {
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 30,
} as const;
