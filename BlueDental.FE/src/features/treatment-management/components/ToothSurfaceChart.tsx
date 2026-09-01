import type { CSSProperties } from "react";
import type { ToothSelectionDto } from "../api/consultingApi";
import { t } from "@/lib/i18n";

/**
 * Odontogram that records the reference's tooth primitive:
 * `{ code, selected, top, right, bottom, left, center }`.
 *
 * Each tooth is drawn as the classic five-region chart — four trapezoids around
 * a central square — so a surface can be marked individually. Clicking the tooth
 * number instead marks the whole tooth (`selected`), which is what the reference
 * stores for services applied to an entire tooth.
 */

export type ToothSurface = "top" | "right" | "bottom" | "left" | "center";

interface ToothSurfaceChartProps {
  value: ToothSelectionDto[];
  onChange: (next: ToothSelectionDto[]) => void;
  readOnly?: boolean;
  style?: CSSProperties;
}

// FDI quadrants laid out as the patient's mouth faces the clinician.
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const SIZE = 30;
const MID = SIZE / 3;
const SELECTED_FILL = "#6366f1";
const SURFACE_FILL = "#a5b4fc";
const EMPTY_FILL = "#FFFFFF";
const STROKE = "#99a0bd";

/** Polygon points for each surface of a SIZE×SIZE tooth tile. */
const SURFACE_SHAPES: Record<ToothSurface, string> = {
  top: `0,0 ${SIZE},0 ${SIZE - MID},${MID} ${MID},${MID}`,
  right: `${SIZE},0 ${SIZE},${SIZE} ${SIZE - MID},${SIZE - MID} ${SIZE - MID},${MID}`,
  bottom: `0,${SIZE} ${MID},${SIZE - MID} ${SIZE - MID},${SIZE - MID} ${SIZE},${SIZE}`,
  left: `0,0 ${MID},${MID} ${MID},${SIZE - MID} 0,${SIZE}`,
  center: `${MID},${MID} ${SIZE - MID},${MID} ${SIZE - MID},${SIZE - MID} ${MID},${SIZE - MID}`,
};

const surfaceLabels = (): Record<ToothSurface, string> => ({
  top: t("mặt trên"),
  right: t("mặt phải"),
  bottom: t("mặt dưới"),
  left: t("mặt trái"),
  center: t("mặt nhai"),
});

function emptyTooth(toothCode: number): ToothSelectionDto {
  return {
    toothCode,
    selected: false,
    top: false,
    right: false,
    bottom: false,
    left: false,
    center: false,
  };
}

/** A tooth with nothing marked is dropped — the server rejects empty selections. */
function isEmpty(tooth: ToothSelectionDto): boolean {
  return (
    !tooth.selected && !tooth.top && !tooth.right && !tooth.bottom && !tooth.left && !tooth.center
  );
}

function ToothTile({
  toothCode,
  tooth,
  readOnly,
  onToggleSurface,
  onToggleTooth,
}: {
  toothCode: number;
  tooth: ToothSelectionDto | undefined;
  readOnly: boolean;
  onToggleSurface: (surface: ToothSurface) => void;
  onToggleTooth: () => void;
}) {
  const wholeToothSelected = tooth?.selected ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <svg width={SIZE} height={SIZE} style={{ display: "block" }}>
        {(Object.keys(SURFACE_SHAPES) as ToothSurface[]).map((surface) => {
          const active = wholeToothSelected || Boolean(tooth?.[surface]);

          return (
            <polygon
              key={surface}
              points={SURFACE_SHAPES[surface]}
              fill={wholeToothSelected ? SELECTED_FILL : active ? SURFACE_FILL : EMPTY_FILL}
              stroke={STROKE}
              strokeWidth={0.75}
              style={{ cursor: readOnly ? "default" : "pointer" }}
              onClick={readOnly ? undefined : () => onToggleSurface(surface)}
            >
              <title>{t("Răng {0} — {1}", toothCode, surfaceLabels()[surface])}</title>
            </polygon>
          );
        })}
      </svg>

      <button
        type="button"
        disabled={readOnly}
        onClick={onToggleTooth}
        title={t("Chọn cả răng {0}", toothCode)}
        style={{
          border: "none",
          background: "none",
          padding: 0,
          fontSize: 11,
          lineHeight: 1.2,
          cursor: readOnly ? "default" : "pointer",
          color: wholeToothSelected ? SELECTED_FILL : "#78819c",
          fontWeight: wholeToothSelected ? 700 : 400,
        }}
      >
        {toothCode}
      </button>
    </div>
  );
}

function ToothRow({
  left,
  right,
  value,
  readOnly,
  onToggleSurface,
  onToggleTooth,
}: {
  left: number[];
  right: number[];
  value: ToothSelectionDto[];
  readOnly: boolean;
  onToggleSurface: (toothCode: number, surface: ToothSurface) => void;
  onToggleTooth: (toothCode: number) => void;
}) {
  const render = (codes: number[]) =>
    codes.map((code) => (
      <ToothTile
        key={code}
        toothCode={code}
        tooth={value.find((t) => t.toothCode === code)}
        readOnly={readOnly}
        onToggleSurface={(surface) => onToggleSurface(code, surface)}
        onToggleTooth={() => onToggleTooth(code)}
      />
    ));

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 3 }}>
      {render(left)}
      <div style={{ width: 10 }} />
      {render(right)}
    </div>
  );
}

export function ToothSurfaceChart({
  value,
  onChange,
  readOnly = false,
  style,
}: ToothSurfaceChartProps) {
  const update = (toothCode: number, mutate: (tooth: ToothSelectionDto) => ToothSelectionDto) => {
    const existing = value.find((t) => t.toothCode === toothCode) ?? emptyTooth(toothCode);
    const next = mutate(existing);
    const rest = value.filter((t) => t.toothCode !== toothCode);

    onChange(
      isEmpty(next)
        ? rest
        : [...rest, next].sort((a, b) => a.toothCode - b.toothCode),
    );
  };

  const toggleSurface = (toothCode: number, surface: ToothSurface) =>
    update(toothCode, (tooth) =>
      // Marking a surface on a whole-tooth selection narrows it back to surfaces.
      tooth.selected
        ? { ...emptyTooth(toothCode), [surface]: true }
        : { ...tooth, [surface]: !tooth[surface] },
    );

  const toggleTooth = (toothCode: number) =>
    update(toothCode, (tooth) =>
      tooth.selected ? emptyTooth(toothCode) : { ...emptyTooth(toothCode), selected: true },
    );

  return (
    <div style={style}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
        <ToothRow
          left={UPPER_RIGHT}
          right={UPPER_LEFT}
          value={value}
          readOnly={readOnly}
          onToggleSurface={toggleSurface}
          onToggleTooth={toggleTooth}
        />
        <div style={{ width: "100%", borderTop: "1px dashed #e7eaf6" }} />
        <ToothRow
          left={LOWER_RIGHT}
          right={LOWER_LEFT}
          value={value}
          readOnly={readOnly}
          onToggleSurface={toggleSurface}
          onToggleTooth={toggleTooth}
        />
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 16, fontSize: 11, color: "#78819c" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: SELECTED_FILL, display: "inline-block", borderRadius: 2 }} />
          {t("Cả răng")}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: SURFACE_FILL, display: "inline-block", borderRadius: 2 }} />
          {t("Mặt răng")}
        </span>
        <span>{t("Bấm số răng để chọn cả răng, bấm vào mặt để chọn từng mặt.")}</span>
      </div>
    </div>
  );
}
