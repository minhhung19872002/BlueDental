// DentalChartView — SVG-based 32-tooth (FDI notation) dental chart.
// Each tooth is an interactive tile that shows its status via fill color.
// Tooth numbering follows the FDI two-digit system (11-18, 21-28, 31-38, 41-48).

import type { CSSProperties } from "react";
import { t } from "@/lib/i18n";

export type ToothStatus =
  | "healthy"
  | "treated"
  | "decayed"
  | "missing"
  | "implant"
  | "crown"
  | "bridge";

export interface ToothRecord {
  fdi: number;
  status: ToothStatus;
  notes?: string;
}

interface Props {
  teeth?: ToothRecord[];
  /** FDI numbers currently picked out. Selected teeth fill indigo and glow. */
  selectedTeeth?: readonly number[];
  onToothClick?: (fdi: number) => void;
  readOnly?: boolean;
  style?: CSSProperties;
}

const STATUS_COLORS: Record<ToothStatus, string> = {
  healthy: "#ffffff",
  treated: "#a5b4fc",
  decayed: "#f2b6b8",
  missing: "#f0f2fa",
  implant: "#a7e0c9",
  crown: "#fbe6a8",
  bridge: "#c9b6f2",
};

const STATUS_STROKE: Record<ToothStatus, string> = {
  healthy: "#a5b4fc",
  treated: "#6366f1",
  decayed: "#cf3c41",
  missing: "#c3c9d8",
  implant: "#0e9f6e",
  crown: "#d98b0f",
  bridge: "#7c5ce0",
};

// Upper jaw: 18→11 (right to left for display), then 21→28 (left to right)
const UPPER_LEFT = [18, 17, 16, 15, 14, 13, 12, 11] as const;
const UPPER_RIGHT = [21, 22, 23, 24, 25, 26, 27, 28] as const;
// Lower jaw: 48→41 (right to left), then 31→38 (left to right)
const LOWER_LEFT = [48, 47, 46, 45, 44, 43, 42, 41] as const;
const LOWER_RIGHT = [31, 32, 33, 34, 35, 36, 37, 38] as const;

const TOOTH_W = 30;
const TOOTH_H = 32;
const GAP = 8;
const LABEL_H = 13;
const ROW_H = TOOTH_H + LABEL_H;

/**
 * The four crown silhouettes, by tooth type. The design draws a mouth, not a
 * row of boxes: an incisor is a blade, a molar is a broad crown on two roots.
 * Each path is a crown-up tooth on a 24x26 canvas; the upper jaw flips it.
 */
const TOOTH_SHAPES = {
  incisor:
    "M7.5 3.5h9L15.6 14c-.4 4-1.7 7.7-2.7 9.6-.5.9-1.3.9-1.8 0-1-1.9-2.3-5.6-2.7-9.6L7.5 3.5z",
  canine:
    "M12 3c3.2 0 5.5 2 5.5 5l-.8 5.4c-.5 3.4-2.2 8.6-3.6 11.2-.5 1-1.7 1-2.2 0-1.4-2.6-3.1-7.8-3.6-11.2L6.5 8c0-3 2.3-5 5.5-5z",
  premolar:
    "M6 8.5C6 5 8.6 3 12 3s6 2 6 5.5l-.7 5.2c-.4 3-2 8.3-3.6 11-.8 1.4-2.6 1.4-3.4 0-1.6-2.7-3.2-8-3.6-11L6 8.5z",
  molar:
    "M4 9c0-4 3.4-6.5 8-6.5S20 5 20 9l-.7 5.5c-.3 2.3-1.2 4.2-2.2 6.8-.4 1.1-2 1-2.2-.2l-.6-3.4h-4.6l-.6 3.4c-.2 1.2-1.8 1.3-2.2.2-1-2.6-1.9-4.5-2.2-6.8L4 9z",
} as const;

/** FDI's last digit says what the tooth is: 1-2 incisor, 3 canine, 4-5 premolar. */
function shapeOf(fdi: number): string {
  const position = fdi % 10;
  if (position <= 2) return TOOTH_SHAPES.incisor;
  if (position === 3) return TOOTH_SHAPES.canine;
  if (position <= 5) return TOOTH_SHAPES.premolar;
  return TOOTH_SHAPES.molar;
}

/**
 * One tooth.
 *
 * The upper jaw is the same silhouette flipped, so its roots point up and away
 * from the bite line, and its FDI number sits below rather than above. A
 * selected tooth fills indigo and lifts on a soft glow.
 */
function ToothCell({
  fdi,
  status,
  jaw,
  selected,
  onClick,
  readOnly,
  ariaLabel,
}: {
  fdi: number;
  status: ToothStatus;
  jaw: "upper" | "lower";
  selected: boolean;
  onClick?: () => void;
  readOnly?: boolean;
  ariaLabel: string;
}) {
  const isMissing = status === "missing";
  const fill = selected ? "#6366f1" : STATUS_COLORS[status];
  const stroke = selected ? "#4f52e0" : STATUS_STROKE[status];
  const numberFill = selected ? "#4f52e0" : isMissing ? "#99a0bd" : "#78819c";
  const isUpper = jaw === "upper";

  const numberY = isUpper ? TOOTH_H + LABEL_H - 3 : LABEL_H - 4;
  const toothY = isUpper ? 0 : LABEL_H;

  return (
    <g
      className={`dental-tooth dental-tooth--${jaw}${selected ? " dental-tooth--on" : ""}`}
      onClick={readOnly ? undefined : onClick}
      style={{ cursor: readOnly ? "default" : "pointer" }}
      role={readOnly ? undefined : "button"}
      aria-label={ariaLabel}
      aria-pressed={readOnly ? undefined : selected}
    >
      <g
        transform={
          isUpper
            ? `translate(${TOOTH_W}, ${toothY + TOOTH_H}) scale(-${TOOTH_W / 24}, -${TOOTH_H / 26})`
            : `translate(0, ${toothY}) scale(${TOOTH_W / 24}, ${TOOTH_H / 26})`
        }
      >
        <path
          d={shapeOf(fdi)}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.3}
          strokeLinejoin="round"
          opacity={isMissing ? 0.4 : 1}
        />
      </g>
      {isMissing && (
        <line
          x1={4}
          y1={toothY + 4}
          x2={TOOTH_W - 4}
          y2={toothY + TOOTH_H - 4}
          stroke={stroke}
          strokeWidth={1.5}
        />
      )}
      <text
        x={TOOTH_W / 2}
        y={numberY}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={numberFill}
        fontFamily="inherit"
      >
        {fdi}
      </text>
    </g>
  );
}

function buildRow(
  fdis: readonly number[],
  teeth: ToothRecord[],
  yOffset: number,
  jaw: "upper" | "lower",
  selectedTeeth: readonly number[],
  toothAriaLabel: (fdi: number, status: string) => string,
  onToothClick?: (fdi: number) => void,
  readOnly?: boolean,
) {
  return fdis.map((fdi, i) => {
    const record = teeth.find((t) => t.fdi === fdi);
    const status = record?.status ?? "healthy";
    const x = i * (TOOTH_W + GAP);
    return (
      <g key={fdi} transform={`translate(${x}, ${yOffset})`}>
        <ToothCell
          fdi={fdi}
          status={status}
          jaw={jaw}
          selected={selectedTeeth.includes(fdi)}
          ariaLabel={toothAriaLabel(fdi, status)}
          onClick={() => onToothClick?.(fdi)}
          readOnly={readOnly}
        />
      </g>
    );
  });
}

/** Total SVG width: 8 teeth + 7 gaps per half, 2 halves + center divider */
const HALF_W = 8 * TOOTH_W + 7 * GAP;
const DIVIDER = 12;
const TOTAL_W = HALF_W * 2 + DIVIDER;
const LABEL_OFFSET = 16; // room for FDI numbers below each tooth

export function DentalChartView({
  teeth = [],
  selectedTeeth = [],
  onToothClick,
  readOnly = false,
  style,
}: Props) {
  const upperY = LABEL_OFFSET;
  const lowerY = upperY + ROW_H + LABEL_OFFSET + 20;
  const totalH = lowerY + ROW_H + LABEL_OFFSET + 8;

  const toothAriaLabel = (fdi: number, status: string) =>
    t("Răng {0} — {1}", fdi, status);

  return (
    <div style={style} aria-label={t("Biểu đồ nha khoa 32 răng")}>
      <svg
        viewBox={`0 0 ${TOTAL_W} ${totalH}`}
        width="100%"
        style={{ display: "block" }}
      >
        {/* Upper jaw */}
        <g transform={`translate(0, ${upperY})`}>
          {buildRow(UPPER_LEFT, teeth, 0, "upper", selectedTeeth, toothAriaLabel, onToothClick, readOnly)}
        </g>
        <g transform={`translate(${HALF_W + DIVIDER}, ${upperY})`}>
          {buildRow(UPPER_RIGHT, teeth, 0, "upper", selectedTeeth, toothAriaLabel, onToothClick, readOnly)}
        </g>

        {/* Center line */}
        <line
          x1={TOTAL_W / 2}
          y1={upperY - 4}
          x2={TOTAL_W / 2}
          y2={lowerY + TOOTH_H + 4}
          stroke="#c3c9d8"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />

        {/* Lower jaw */}
        <g transform={`translate(0, ${lowerY})`}>
          {buildRow(LOWER_LEFT, teeth, 0, "lower", selectedTeeth, toothAriaLabel, onToothClick, readOnly)}
        </g>
        <g transform={`translate(${HALF_W + DIVIDER}, ${lowerY})`}>
          {buildRow(LOWER_RIGHT, teeth, 0, "lower", selectedTeeth, toothAriaLabel, onToothClick, readOnly)}
        </g>

        {/* Jaw labels */}
        <text
          x={TOTAL_W / 2}
          y={upperY - 8}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={700}
          letterSpacing={1.2}
          fill="#7d85a5"
          fontFamily="inherit"
          style={{ textTransform: "uppercase" }}
        >
          {t("Hàm Trên")}
        </text>
        <text
          x={TOTAL_W / 2}
          y={lowerY - 8}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={700}
          letterSpacing={1.2}
          fill="#7d85a5"
          fontFamily="inherit"
          style={{ textTransform: "uppercase" }}
        >
          {t("Hàm Dưới")}
        </text>
      </svg>
    </div>
  );
}
