/**
 * The eight swatches a label colour offers before the custom picker. Grey is
 * not one of them: grey is what "no colour" already reads as (R-1072).
 */
export const LABEL_COLOR_PRESETS = [
  "#2671D8",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#14B8A6",
] as const;

/** What the custom picker opens on when no colour is chosen — the badge's own grey. */
export const LABEL_COLOR_DEFAULT = "#64748B";

/**
 * Whether white text would drown on this fill. YIQ brightness from 186 up is
 * the usual cut: every preset stays white, a pale custom colour turns the text
 * dark.
 */
export function isLightColor(hex: string): boolean {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return false;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16));
  return (r * 299 + g * 587 + b * 114) / 1000 >= 186;
}

/**
 * A staff member's badge before a colour is chosen: RGB(255, 0, 127), the
 * owner's pick (R-1155). Kept apart from the grey every other label uses.
 */
export const STAFF_LABEL_COLOR_DEFAULT = "#FF007F";
