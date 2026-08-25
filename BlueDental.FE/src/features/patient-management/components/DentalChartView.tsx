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
  onToothClick?: (fdi: number) => void;
  readOnly?: boolean;
  style?: CSSProperties;
}

const STATUS_COLORS: Record<ToothStatus, string> = {
  healthy: "#ffffff",
  treated: "#90CAF9",
  decayed: "#EF9A9A",
  missing: "#EEEEEE",
  implant: "#A5D6A7",
  crown: "#FFF59D",
  bridge: "#CE93D8",
};

const STATUS_STROKE: Record<ToothStatus, string> = {
  healthy: "#90CAF9",
  treated: "#1565C0",
  decayed: "#C62828",
  missing: "#BDBDBD",
  implant: "#2E7D32",
  crown: "#F57F17",
  bridge: "#6A1B9A",
};

// Upper jaw: 18→11 (right to left for display), then 21→28 (left to right)
const UPPER_LEFT = [18, 17, 16, 15, 14, 13, 12, 11] as const;
const UPPER_RIGHT = [21, 22, 23, 24, 25, 26, 27, 28] as const;
// Lower jaw: 48→41 (right to left), then 31→38 (left to right)
const LOWER_LEFT = [48, 47, 46, 45, 44, 43, 42, 41] as const;
const LOWER_RIGHT = [31, 32, 33, 34, 35, 36, 37, 38] as const;

const TOOTH_W = 34;
const TOOTH_H = 42;
const GAP = 5;
const ROW_H = TOOTH_H + GAP;

/**
 * One tooth. The design writes the FDI number inside the tooth rather than
 * under it — a row of blank boxes with numbers beneath reads as a form, not a
 * mouth — and rounds the crown end more than the root end, so an upper tooth
 * and a lower one are not the same rectangle.
 */
/** Rectangle with per-corner radii, clockwise from the top-left. */
function roundedRectPath(w: number, h: number, tl: number, tr: number, br: number, bl: number): string {
  return [
    `M ${tl} 0`,
    `H ${w - tr}`, `A ${tr} ${tr} 0 0 1 ${w} ${tr}`,
    `V ${h - br}`, `A ${br} ${br} 0 0 1 ${w - br} ${h}`,
    `H ${bl}`, `A ${bl} ${bl} 0 0 1 0 ${h - bl}`,
    `V ${tl}`, `A ${tl} ${tl} 0 0 1 ${tl} 0`,
    "Z",
  ].join(" ");
}

function ToothCell({
  fdi,
  status,
  jaw,
  onClick,
  readOnly,
  ariaLabel,
}: {
  fdi: number;
  status: ToothStatus;
  jaw: "upper" | "lower";
  onClick?: () => void;
  readOnly?: boolean;
  ariaLabel: string;
}) {
  const fill = STATUS_COLORS[status];
  const stroke = STATUS_STROKE[status];
  const isMissing = status === "missing";
  const crownRadius = 9;
  const rootRadius = 6;
  const path =
    jaw === "upper"
      ? roundedRectPath(TOOTH_W, TOOTH_H, crownRadius, crownRadius, rootRadius, rootRadius)
      : roundedRectPath(TOOTH_W, TOOTH_H, rootRadius, rootRadius, crownRadius, crownRadius);

  return (
    <g
      onClick={readOnly ? undefined : onClick}
      style={{ cursor: readOnly ? "default" : "pointer" }}
      role={readOnly ? undefined : "button"}
      aria-label={ariaLabel}
    >
      <path
        d={path}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        opacity={isMissing ? 0.4 : 1}
      />
      {isMissing && (
        <>
          <line
            x1={4}
            y1={4}
            x2={TOOTH_W - 4}
            y2={TOOTH_H - 4}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <line
            x1={TOOTH_W - 4}
            y1={4}
            x2={4}
            y2={TOOTH_H - 4}
            stroke={stroke}
            strokeWidth={1.5}
          />
        </>
      )}
      <text
        x={TOOTH_W / 2}
        y={TOOTH_H / 2 + 4}
        textAnchor="middle"
        fontSize={11.5}
        fontWeight={700}
        fill={isMissing ? "#98a4b4" : "#41505f"}
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
          {buildRow(UPPER_LEFT, teeth, 0, "upper", toothAriaLabel, onToothClick, readOnly)}
        </g>
        <g transform={`translate(${HALF_W + DIVIDER}, ${upperY})`}>
          {buildRow(UPPER_RIGHT, teeth, 0, "upper", toothAriaLabel, onToothClick, readOnly)}
        </g>

        {/* Center line */}
        <line
          x1={TOTAL_W / 2}
          y1={upperY - 4}
          x2={TOTAL_W / 2}
          y2={lowerY + TOOTH_H + 4}
          stroke="#C5D5E4"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />

        {/* Lower jaw */}
        <g transform={`translate(0, ${lowerY})`}>
          {buildRow(LOWER_LEFT, teeth, 0, "lower", toothAriaLabel, onToothClick, readOnly)}
        </g>
        <g transform={`translate(${HALF_W + DIVIDER}, ${lowerY})`}>
          {buildRow(LOWER_RIGHT, teeth, 0, "lower", toothAriaLabel, onToothClick, readOnly)}
        </g>

        {/* Jaw labels */}
        <text
          x={TOTAL_W / 2}
          y={upperY - 8}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={700}
          letterSpacing={1.2}
          fill="#7d8a9c"
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
          fill="#7d8a9c"
          fontFamily="inherit"
          style={{ textTransform: "uppercase" }}
        >
          {t("Hàm Dưới")}
        </text>
      </svg>
    </div>
  );
}
