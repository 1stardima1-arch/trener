// Validated categorical / status hues — see dataviz skill (references/palette.md).
// Chosen so adjacent series clear the CVD + normal-vision separation checks on
// the app's light surface; the accent hues (blue/status) hold up fine on the
// dark surface too, unlike axis/grid/text, so only those reference the
// theme-reactive CSS vars (which flip automatically with the .dark class —
// no JS/state needed here, SVG presentation attributes resolve var()).
export const CHART = {
  surface: "var(--color-surface)",
  textPrimary: "var(--color-ink)",
  textSecondary: "var(--color-ink-soft)",
  categorical: ["#2a78d6", "#008300", "#eb6834", "#4a3aa7", "#1baf7a"],
  blue: "#2a78d6",
  status: {
    good: "#0ca30c",
    critical: "#d03b3b",
  },
  grid: "var(--color-chart-grid)",
};
