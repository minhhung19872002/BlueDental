import { t } from "@/lib/i18n";

/**
 * The five clickable areas of one tooth in the reference's chart: the four
 * quadrants of the rotated circle (visual top / right / left / bottom) plus
 * the centre disc. Index order is also the order the reference prints them in.
 */
export type ToothSurface = "top" | "right" | "left" | "bottom" | "center";

export const TOOTH_SURFACES: readonly ToothSurface[] = ["top", "right", "left", "bottom", "center"];

/** One selected tooth; an empty surface list means the whole tooth. */
export interface ToothPick {
  fdi: number;
  surfaces: ToothSurface[];
}

export type Jaw = "upper" | "lower";

export interface ToothChartHalf {
  jaw: Jaw;
  /** FDI numbers left → right as drawn (patient's right side first). */
  teeth: number[];
}

const range = (from: number, to: number): number[] => {
  const step = from <= to ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => from + i * step);
};

/** The radio pair above the chart: adult teeth (quadrants 1–4) or baby teeth (5–8). */
export type Dentition = "permanent" | "deciduous";

/** Permanent dentition, laid out as the reference draws it: Q1 | Q2 over Q4 | Q3. */
export const PERMANENT_HALVES: readonly ToothChartHalf[] = [
  { jaw: "upper", teeth: range(18, 11) },
  { jaw: "upper", teeth: range(21, 28) },
  { jaw: "lower", teeth: range(48, 41) },
  { jaw: "lower", teeth: range(31, 38) },
];

/** Deciduous dentition: five teeth per quadrant, Q5 | Q6 over Q8 | Q7. */
export const DECIDUOUS_HALVES: readonly ToothChartHalf[] = [
  { jaw: "upper", teeth: range(55, 51) },
  { jaw: "upper", teeth: range(61, 65) },
  { jaw: "lower", teeth: range(85, 81) },
  { jaw: "lower", teeth: range(71, 75) },
];

export const DENTITION_HALVES: Record<Dentition, readonly ToothChartHalf[]> = {
  permanent: PERMANENT_HALVES,
  deciduous: DECIDUOUS_HALVES,
};

export const UPPER_TEETH: readonly number[] = [...range(18, 11), ...range(21, 28)];
export const LOWER_TEETH: readonly number[] = [...range(48, 41), ...range(31, 38)];

export function isDeciduous(fdi: number): boolean {
  return Math.floor(fdi / 10) >= 5;
}

/** Which chart a set of picks belongs on; an empty set defaults to the adult chart. */
export function dentitionOf(picks: readonly ToothPick[]): Dentition {
  return picks.some((pick) => isDeciduous(pick.fdi)) ? "deciduous" : "permanent";
}

/**
 * Permanent positions 6–8 are molars; the reference draws 1–5 with the same
 * "front tooth" image, and every deciduous tooth with it too.
 */
export function isMolar(fdi: number): boolean {
  return !isDeciduous(fdi) && fdi % 10 >= 6;
}

/**
 * The anatomical name of a surface depends on the quadrant: "top" is the
 * outer face on the upper jaw but the inner face on the lower one, and the
 * mesial face points toward the midline, so it swaps sides between Q1/Q4 and
 * Q2/Q3. Observed on staging by selecting every quadrant in turn.
 */
export function surfaceLabel(fdi: number, surface: ToothSurface): string {
  // Deciduous quadrants 5–8 sit in the same corners as permanent 1–4.
  const quadrant = ((Math.floor(fdi / 10) - 1) % 4) + 1;
  const upper = quadrant === 1 || quadrant === 2;
  const midlineOnRight = quadrant === 1 || quadrant === 4;
  switch (surface) {
    case "top":
      return upper ? t("Mặt ngoài") : t("Mặt trong");
    case "bottom":
      return upper ? t("Mặt trong") : t("Mặt ngoài");
    case "right":
      return midlineOnRight ? t("Mặt gần") : t("Mặt xa");
    case "left":
      return midlineOnRight ? t("Mặt xa") : t("Mặt gần");
    case "center":
      return t("Mặt nhai");
  }
}

/** "17 - Mặt ngoài, Mặt nhai" or plain "11" — the reference's summary of one pick. */
export function formatToothPick(pick: ToothPick): string {
  if (pick.surfaces.length === 0) return String(pick.fdi);
  const labels = TOOTH_SURFACES.filter((surface) => pick.surfaces.includes(surface)).map(
    (surface) => surfaceLabel(pick.fdi, surface),
  );
  return `${pick.fdi} - ${labels.join(", ")}`;
}

/** Clicking the tooth itself toggles the whole tooth, surfaces and all. */
export function toggleTooth(picks: ToothPick[], fdi: number): ToothPick[] {
  return picks.some((pick) => pick.fdi === fdi)
    ? picks.filter((pick) => pick.fdi !== fdi)
    : [...picks, { fdi, surfaces: [] }];
}

/**
 * Clicking a surface selects the tooth if needed; removing its last surface
 * drops the tooth again (observed on staging, tooth 31).
 */
export function toggleSurface(picks: ToothPick[], fdi: number, surface: ToothSurface): ToothPick[] {
  const current = picks.find((pick) => pick.fdi === fdi);
  if (!current) return [...picks, { fdi, surfaces: [surface] }];
  const surfaces = current.surfaces.includes(surface)
    ? current.surfaces.filter((item) => item !== surface)
    : [...current.surfaces, surface];
  if (surfaces.length === 0) return picks.filter((pick) => pick.fdi !== fdi);
  return picks.map((pick) => (pick.fdi === fdi ? { fdi, surfaces } : pick));
}
