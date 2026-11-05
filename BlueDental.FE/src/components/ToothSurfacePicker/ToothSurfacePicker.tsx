import { useId, type KeyboardEvent } from "react";
import { t } from "@/lib/i18n";
import { isMolar } from "@/components/ToothChart/toothModel";
import { outerFace, TOOTH_CIRCLE as shape } from "./toothShapes";
import { slotOf, surfaceName, surfacesOf, type ToothSurfaceCode } from "./toothSurfaces";
import "./tooth-surface-picker.css";

export interface ToothSurfacePickerProps {
  /** FDI number: a front tooth shows Cắn / Ngoài, a back one Nhai / Má. */
  tooth: number;
  picked: readonly ToothSurfaceCode[];
  /** The surface whose Màu is being typed. */
  active?: ToothSurfaceCode;
  /** Màu under each picked surface's name, "?" when blank; left out, no colour line. */
  shades?: Partial<Record<ToothSurfaceCode, string>>;
  /** Picked surfaces still lacking a colour: ringed red. */
  missing?: readonly ToothSurfaceCode[];
  /** Left out, the picture only shows the pick. */
  onPick?: (code: ToothSurfaceCode) => void;
  /** The tooth picture clicked: every surface at once (BA, R-1150). */
  onPickAll?: () => void;
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
export function ToothSurfacePicker({ tooth, picked, active, shades, missing, onPick, onPickAll }: ToothSurfacePickerProps) {
  const clipId = useId();
  const upper = isUpperTooth(tooth);

  const stateOf = (code: ToothSurfaceCode) => {
    if (!picked.includes(code)) return "off";
    return code === active ? "active" : "on";
  };

  const face = (code: ToothSurfaceCode) => {
    const slot = slotOf(code);
    const state = stateOf(code);
    const name = surfaceName(code);
    const shade = state === "off" || !shades ? undefined : shades[code]?.trim() || "?";
    const [x, nameY, shadeY] = shape.labels[slot];
    const className = ["tsp-face", `tsp-face--${state}`, missing?.includes(code) && "tsp-face--missing"]
      .filter(Boolean)
      .join(" ");
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onPick?.(code);
    };
    return (
      <g
        key={code}
        className={className}
        data-surface={code}
        role={onPick ? "button" : undefined}
        tabIndex={onPick ? 0 : undefined}
        aria-pressed={onPick ? state !== "off" : undefined}
        aria-label={onPick ? name : undefined}
        onClick={onPick ? () => onPick(code) : undefined}
        onKeyDown={onPick ? handleKey : undefined}
      >
        {slot === "center" ? (
          <path d={shape.center} />
        ) : (
          <polygon points={outerFace(slot, shape.hub)} clipPath={`url(#${clipId})`} />
        )}
        <text x={x} y={shade ? nameY : (nameY + shadeY) / 2} className="tsp-name">
          {name}
        </text>
        {shade && (
          <text x={x} y={shadeY} className="tsp-shade">
            {shade}
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
      className={["tsp-circle", onPick && "tsp--interactive"].filter(Boolean).join(" ")}
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
      <path d={shape.outline} className="tsp-outline" />
    </svg>
  );

  return (
    <div className="tsp">
      {upper ? picture : diagram}
      {upper ? diagram : picture}
    </div>
  );
}
