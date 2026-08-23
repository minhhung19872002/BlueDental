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

const TOOTH_W = 32;
const TOOTH_H = 40;
const GAP = 4;
const ROW_H = TOOTH_H + GAP;

function ToothCell({
  fdi,
  status,
  onClick,
  readOnly,
}: {
  fdi: number;
  status: ToothStatus;
  onClick?: () => void;
  readOnly?: boolean;
}) {
  const fill = STATUS_COLORS[status];
  const stroke = STATUS_STROKE[status];
  const isMissing = status === "missing";

  return (
    <g
      onClick={readOnly ? undefined : onClick}
      style={{ cursor: readOnly ? "default" : "pointer" }}
      role={readOnly ? undefined : "button"}
      aria-label={t("Răng {0} — {1}", fdi, status)}
    >
      <rect
        width={TOOTH_W}
        height={TOOTH_H}
        rx={5}
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
        y={TOOTH_H + 13}
        textAnchor="middle"
        fontSize={9}
        fill="#5E748E"
        fontFamily="Inter, sans-serif"
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

  return (
    <div style={style} aria-label={t("Biểu đồ nha khoa 32 răng")}>
      <svg
        viewBox={`0 0 ${TOTAL_W} ${totalH}`}
        width="100%"
        style={{ display: "block" }}
      >
        {/* Upper jaw */}
        <g transform={`translate(0, ${upperY})`}>
          {buildRow(UPPER_LEFT, teeth, 0, onToothClick, readOnly)}
        </g>
        <g transform={`translate(${HALF_W + DIVIDER}, ${upperY})`}>
          {buildRow(UPPER_RIGHT, teeth, 0, onToothClick, readOnly)}
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
          {buildRow(LOWER_LEFT, teeth, 0, onToothClick, readOnly)}
        </g>
        <g transform={`translate(${HALF_W + DIVIDER}, ${lowerY})`}>
          {buildRow(LOWER_RIGHT, teeth, 0, onToothClick, readOnly)}
        </g>

        {/* Jaw labels */}
        <text
          x={TOTAL_W / 2}
          y={upperY - 8}
          textAnchor="middle"
          fontSize={10}
          fill="#8FA8C0"
          fontFamily="Inter, sans-serif"
        >
          {t("Hàm trên")}
        </text>
        <text
          x={TOTAL_W / 2}
          y={lowerY - 8}
          textAnchor="middle"
          fontSize={10}
          fill="#8FA8C0"
          fontFamily="Inter, sans-serif"
        >
          {t("Hàm dưới")}
        </text>
      </svg>
    </div>
  );
}
