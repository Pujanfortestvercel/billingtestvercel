// ---------------------------------------------------------------------------
// DESIGN TOKENS — COLORS
// ---------------------------------------------------------------------------
// Instead of scattering color codes like "#2563EB" across dozens of files,
// we define every color ONCE, here, and import it everywhere.
//
// Why this matters (a core rule of scalable code — "one source of truth"):
//   • Rebrand the whole app by changing one value here.
//   • No more guessing "which blue did I use on the buttons?"
//   • Consistency is automatic.
// ---------------------------------------------------------------------------

export const colors = {
  // Brand colors — used for buttons, highlights, the status bar.
  primary: '#2563EB',
  primaryDark: '#1D4ED8',

  // Status colors — feedback to the user.
  success: '#16A34A', // green  — saved, active subscription
  danger: '#DC2626', // red    — errors, delete, frozen accounts
  warning: '#D97706', // amber  — trial expiring, warnings

  // Neutrals — backgrounds, surfaces, text.
  background: '#F3F4F6', // the screen behind cards
  surface: '#FFFFFF', // cards, inputs, sheets
  border: '#E5E7EB', // hairlines around cards/inputs
  text: '#111827', // primary text (almost black)
  textMuted: '#6B7280', // secondary/hint text (gray)

  white: '#FFFFFF',
  black: '#000000',
} as const;

// `as const` tells TypeScript these values never change, which gives us
// better auto-complete and prevents accidental typos elsewhere.
