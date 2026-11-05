import { useId, type KeyboardEvent } from "react";
import { t } from "@/lib/i18n";
import { isMolar } from "@/components/ToothChart/toothModel";
import { fitShade, outerFace, TOOTH_CIRCLE as shape } from "./toothShapes";
import { slotOf, surfaceName, surfacesOf, type ToothSurfaceCode } from "./toothSurfaces";
import "./tooth-surface-picker.css";

/** What the faces show beyond the pick. */
export interface ToothSurfaceMarks {
  /** The surface whose Màu is being typed. */
  active?: ToothSurfaceCode;
  /**
   * Fault mode (Labo 2 v2, R-1151): `picked` are the faces ordered, greyed
   * otherwise, and only they can be clicked; these are the ones found faulty, red.
   */
  faults?: readonly ToothSurfaceCode[];
}

export interface ToothSurfacePickerProps {
  /** FDI number: a front tooth shows Cắn / Ngoài, a back one Nhai / Má. */
  tooth: number;
  picked: readonly ToothSurfaceCode[];
  /** Màu under each picked surface's name; a blank one shows nothing (BA "Bỏ cái ?", R-1154). */
  shades?: Partial<Record<ToothSurfaceCode, string>>;
  marks?: ToothSurfaceMarks;
  /** Left out, the picture only shows the pick. In fault mode it toggles a fault. */
  onPick?: (code: ToothSurfaceCode) => void;
  /** The tooth picture clicked: every surface at once (BA, R-1150). */
  onPickAll?: () => void;
  /**
   * "jaw" (default): a lower tooth's picture sits under the circle, as on the
   * chart. "top": every tooth's picture sits over it (Labo Đặt hàng, owner).
   */
  picturePlacement?: "jaw" | "top";
}

/** Quadrants 1, 2, 5, 6: the crown hangs down over the circle, as on the chart. */
const isUpperTooth = (fdi: number) => [1, 2, 5, 6].includes(Math.floor(fdi / 10));

/**
 * Mặt răng on one tooth (R-1150): the tooth's picture as the dental chart
 * draws it (its number is already in the card's title), over a large copy of the chart's surface circle
 * (the BA's "cho nó bự lên … cho dễ ấn"). A face is clicked or focused and
 * pressed to pick it; the picture picks all five (BA "chọn hình răng là chọn
 * tất cả các mặt"), or takes them all off when all five are on.
 */
export function ToothSurfacePicker({
  tooth,
  picked,
  shades,
  marks = {},
  onPick,
  onPickAll,
  picturePlacement = "jaw",
}: ToothSurfacePickerProps) {
  const clipId = useId();
  const upper = isUpperTooth(tooth);
  const pictureFirst = upper || picturePlacement === "top";
  const { active, faults } = marks;
  const faultMode = faults !== undefined;

  const stateOf = (code: ToothSurfaceCode) => {
    if (!picked.includes(code)) return faultMode ? "blank" : "off";
    if (faults?.includes(code)) return "fault";
    return code === active ? "active" : "on";
  };

  const face = (code: ToothSurfaceCode) => {
    const slot = slotOf(code);
    const state = stateOf(code);
    // In fault mode a face not ordered is only drawn.
    const pick = state === "blank" ? undefined : onPick;
    const name = surfaceName(code);
    const shade = state === "off" || state === "blank" || !shades ? undefined : shades[code]?.trim() || undefined;
    const [x, nameY, shadeY] = shape.labels[slot];
    const fitted = shade === undefined ? undefined : fitShade(shade, slot);
    // BA picker mock (R-1154): a picked face reads white with a tick, under its name or beside it over its Màu.
    const ticked = !faultMode && (state === "on" || state === "active");
    const className = ["tsp-face", `tsp-face--${state}`].join(" ");
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      pick?.(code);
    };
    return (
      <g
        key={code}
        className={className}
        data-surface={code}
        role={pick ? "button" : undefined}
        tabIndex={pick ? 0 : undefined}
        aria-pressed={pick ? state !== "off" && (!faultMode || state === "fault") : undefined}
        aria-label={pick ? name : undefined}
        onClick={pick ? () => pick(code) : undefined}
        onKeyDown={pick ? handleKey : undefined}
      >
        {fitted?.cut && <title>{`${name}: ${shade}`}</title>}
        {slot === "center" ? (
          <path d={shape.center} />
        ) : (
          <polygon points={outerFace(slot, shape.hub)} clipPath={`url(#${clipId})`} />
        )}
        <text x={x} y={fitted || ticked ? nameY : (nameY + shadeY) / 2} className="tsp-name">
          {name}
          {ticked && fitted && (
            <tspan className="tsp-tick" dx="2">
              ✓
            </tspan>
          )}
        </text>
        {fitted && (
          <text x={x} y={shadeY} className={["tsp-shade", fitted.small && "tsp-shade--small"].filter(Boolean).join(" ")}>
            {fitted.text}
          </text>
        )}
        {ticked && !fitted && (
          <text x={x} y={shadeY} className="tsp-tick">
            ✓
          </text>
        )}
      </g>
    );
  };

  const codes = surfacesOf(tooth);
  const outer = codes.filter((code) => slotOf(code) !== "center");
  const center = codes.filter((code) => slotOf(code) === "center");

  const allPicked = codes.every((code) => picked.includes(code));
  const pictureClass = ["tsp-tooth", !upper && "tsp-tooth--lower", onPickAll && "tsp-tooth--button"]
    .filter(Boolean)
    .join(" ");
  const image = <img src={isMolar(tooth) ? "/img/teeth/molars.png" : "/img/teeth/premolars.png"} alt="" draggable={false} />;
  const allLabel = t(allPicked ? "Labo:Spec:UnpickAllSurfaces" : "Labo:Spec:PickAllSurfaces", `R${tooth}`);
  const picture = onPickAll ? (
    <button type="button" className={pictureClass} aria-pressed={allPicked} aria-label={allLabel} title={allLabel} onClick={onPickAll}>
      {image}
    </button>
  ) : (
    <span className={pictureClass}>{image}</span>
  );

  const diagram = (
    <svg
      className={["tsp-circle", onPick && "tsp--interactive", faultMode && "tsp--faults"].filter(Boolean).join(" ")}
      viewBox="0 0 120 120"
      role="group"
      aria-label={t("Labo:Spec:SurfaceDiagram", `R${tooth}`)}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={shape.outline} />
        </clipPath>
      </defs>
      {outer.map(face)}
      {center.map(face)}
    </svg>
  );

  return (
    <div className={["tsp", faultMode && "tsp--fault-mode"].filter(Boolean).join(" ")}>
      {pictureFirst ? picture : diagram}
      {pictureFirst ? diagram : picture}
    </div>
  );
}
