import { DeleteOutlined } from "@ant-design/icons";
import { surfaceName, type ToothSurfaceCode } from "@/components/ToothSurfacePicker";
import { t } from "@/lib/i18n";
import { toothLabel, type LaboSpecValue } from "./laboToothSpecs";
import type { LaboSpecContext } from "./laboSpecContext";
import { LaboShadeInput, LaboSpecSelect } from "./LaboSpecInputs";

interface Props {
  fdi: string;
  context: LaboSpecContext;
  value: LaboSpecValue;
  active: ToothSurfaceCode | undefined;
  /** Màu only (Chung thông số), or Màu and Đường hoàn tất (Riêng thông số). */
  columns: "shade" | "shade-finish";
  onActive: (code: ToothSurfaceCode) => void;
  onRemove: (code: ToothSurfaceCode) => void;
}

/**
 * One row per picked surface of a "Riêng theo mặt" tooth: its name (pressed,
 * it lights the face on the picture), its Màu, its Đường hoàn tất when the
 * parameters are per tooth, and 🗑 to take the surface off.
 */
export function LaboSurfaceRows({ fdi, context, value, active, columns, onActive, onRemove }: Props) {
  const readOnly = context.form.readOnly;
  const failing = new Set(
    context.errors.filter((error) => error.row === fdi && error.surface).map((error) => error.surface),
  );

  return (
    <div className={`pd-lts-srows pd-lts-srows--${columns}`}>
      {(value.surfaces ?? []).map((code) => {
        const name = surfaceName(code);
        const path = ["specs", fdi, "surfaceSpecs", code];
        const className = ["pd-lts-srow", code === active && "pd-lts-srow--active"].filter(Boolean).join(" ");
        return (
          <div key={code} className={className} data-surface={code}>
            <button type="button" className="pd-lts-sname" aria-pressed={code === active} onClick={() => onActive(code)}>
              <span className="pd-lts-sdot" aria-hidden />
              {name}
            </button>
            <LaboShadeInput
              name={[...path, "shade"]}
              label={`${t("Labo:Spec:Shade")} ${name} ${toothLabel(fdi)}`}
              error={failing.has(code)}
              disabled={readOnly}
            />
            {columns === "shade-finish" && (
              <LaboSpecSelect name={[...path, "finishLineId"]} options={context.form.options.finishLines} disabled={readOnly} />
            )}
            {readOnly ? (
              <span />
            ) : (
              <button
                type="button"
                className="pd-lts-remove"
                aria-label={t("Labo:Spec:RemoveSurface", name)}
                title={t("Labo:Spec:RemoveSurface", name)}
                onClick={() => onRemove(code)}
              >
                <DeleteOutlined />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
