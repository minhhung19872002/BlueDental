import { surfaceList, type ToothSurfaceCode } from "@/components/ToothSurfacePicker";
import { t } from "@/lib/i18n";
import { LABO_SPEC_MODE } from "@/features/labo/api/laboApi";
import { joinSurfaces, splitBySurface, withoutSurface } from "./laboSpecEdits";
import { canSplit, isSplit, SHARED_ROW, sharesShade, toothLabel, type LaboSpecValue } from "./laboToothSpecs";
import type { LaboSpecContext } from "./laboSpecContext";
import { LaboPerToothSpec } from "./LaboPerToothSpec";
import { LaboShadeInput, LaboSpecLabel } from "./LaboSpecInputs";
import { LaboSurfaceRows } from "./LaboSurfaceRows";
import { LaboToggle, type LaboToggleItem } from "./LaboToggle";

type SurfaceScope = "shared" | "split";

interface Props {
  fdi: string;
  context: LaboSpecContext;
  value: LaboSpecValue;
  active: ToothSurfaceCode | undefined;
  onActive: (code: ToothSurfaceCode | undefined) => void;
  onChange: (value: LaboSpecValue) => void;
}

/**
 * Right of the tooth picture (Labo v2 mock): the surfaces picked, the Chung /
 * Riêng theo mặt switch once there are two, then what the mode leaves to the
 * tooth — nothing (Chung tất cả), its Màu (Chung thông số), or its Kiểu
 * nhịp, Màu and Đường hoàn tất (Riêng thông số).
 */
export function LaboToothSurfacePanel({ fdi, context, value, active, onActive, onChange }: Props) {
  const { mode, form } = context;
  const split = isSplit(mode, value);
  const shadeMissing = context.errors.some((error) => error.row === fdi && error.kind === "shade" && !error.surface);
  const scopes: LaboToggleItem<SurfaceScope>[] = [
    { key: "shared", label: t("Labo:Spec:SurfaceShared") },
    { key: "split", label: t("Labo:Spec:SurfaceSplit") },
  ];

  const handleScope = (scope: SurfaceScope) =>
    onChange(scope === "split" ? splitBySurface(value, context.rows?.[SHARED_ROW]) : joinSurfaces(value));
  const handleRemove = (code: ToothSurfaceCode) => {
    onChange(withoutSurface(Number(fdi), value, code));
    if (active === code) onActive(undefined);
  };
  const surfaceRows = (columns: "shade" | "shade-finish") => (
    <LaboSurfaceRows
      fdi={fdi}
      context={context}
      value={value}
      active={active}
      columns={columns}
      onActive={onActive}
      onRemove={handleRemove}
    />
  );

  return (
    <div className="pd-lts-panel">
      <div className="pd-lts-line">
        <LaboSpecLabel required>{t("Labo:Spec:Surfaces")}</LaboSpecLabel>
        <span className="pd-lts-surfaces">{surfaceList(value.surfaces ?? []) || "—"}</span>
        {canSplit(mode, value) && (
          <LaboToggle
            size="sm"
            label={`${t("Labo:Spec:Surfaces")} ${toothLabel(fdi)}`}
            items={scopes}
            value={split ? "split" : "shared"}
            disabled={form.readOnly}
            onChange={handleScope}
          />
        )}
      </div>
      {sharesShade(mode) && <p className="pd-lts-inherit">{t("Labo:Spec:Inherit")}</p>}
      {mode === LABO_SPEC_MODE.SharedSpecOwnShade && split && (
        <div className="pd-lts-block">
          <LaboSpecLabel required>{t("Labo:Spec:ShadeBySurface")}</LaboSpecLabel>
          {surfaceRows("shade")}
        </div>
      )}
      {mode === LABO_SPEC_MODE.SharedSpecOwnShade && !split && (
        <div className="pd-lts-line">
          <LaboSpecLabel required>{t("Patient:DentalChart:ToothColor")}</LaboSpecLabel>
          <LaboShadeInput
            name={["specs", fdi, "shade"]}
            label={`${t("Patient:DentalChart:ToothColor")} ${toothLabel(fdi)}`}
            error={shadeMissing}
            disabled={form.readOnly}
          />
          <span className="pd-lts-note">{t("Labo:Spec:ShadeAllSurfaces")}</span>
        </div>
      )}
      {mode === LABO_SPEC_MODE.PerTooth && (
        <LaboPerToothSpec
          fdi={fdi}
          context={context}
          surfaceRows={split ? surfaceRows("shade-finish") : undefined}
          shadeMissing={shadeMissing}
        />
      )}
    </div>
  );
}
