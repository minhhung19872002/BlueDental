import { useState } from "react";
import { ToothSurfacePicker, type ToothSurfaceCode } from "@/components/ToothSurfacePicker";
import { t } from "@/lib/i18n";
import { pickedAllSurfaces, pickedSurface } from "./laboSpecEdits";
import { missingSurfaces, toothSummary } from "./laboSpecRules";
import { isSplit, pickerShades, toothLabel, type LaboSpecValue } from "./laboToothSpecs";
import { setSpecRow, type LaboSpecContext } from "./laboSpecContext";
import { LaboSpecCardHead } from "./LaboSpecCardHead";
import { LaboToothSurfacePanel } from "./LaboToothSurfacePanel";

interface Props {
  fdi: string;
  context: LaboSpecContext;
  /** The tooth is already on another order of the slip: its number reads orange (R-1106). */
  prior: boolean;
  open: boolean;
  onToggle: (fdi: string) => void;
}

/**
 * One tooth of Thông số từng răng (Labo v2, R-1150): the tooth drawn from its
 * biting face to pick its Mặt răng (the BA's "lấy hình của 1 răng"), the
 * values its mode leaves to it beside it.
 */
export function LaboToothSpecCard({ fdi, context, prior, open, onToggle }: Props) {
  const [active, setActive] = useState<ToothSurfaceCode>();
  const { mode, rows, form } = context;
  const value = rows?.[fdi] ?? {};
  const picked = value.surfaces ?? [];
  const errors = context.errors.filter((error) => error.row === fdi);
  const split = isSplit(mode, value);

  const update = (next: LaboSpecValue) => setSpecRow(context, fdi, next);
  const handlePick = (code: ToothSurfaceCode) => {
    const pick = pickedSurface(Number(fdi), value, code, mode);
    update(pick.value);
    setActive(pick.active);
  };
  const handlePickAll = () => {
    update(pickedAllSurfaces(Number(fdi), value));
    setActive(undefined);
  };
  const className = ["pd-lts-card", errors.length > 0 && "pd-lts-card--error"].filter(Boolean).join(" ");

  return (
    <article className={className} data-tooth={fdi}>
      <LaboSpecCardHead
        title={toothLabel(fdi)}
        prior={prior}
        summary={toothSummary(fdi, mode, rows, context.names)}
        errors={errors.length}
        open={open}
        onToggle={() => onToggle(fdi)}
      />
      {open && (
        <div className="pd-lts-body pd-lts-tooth">
          <div className="pd-lts-picker">
            <ToothSurfacePicker
              tooth={Number(fdi)}
              picked={picked}
              active={split ? active : undefined}
              shades={pickerShades(fdi, mode, rows)}
              missing={missingSurfaces(errors, picked)}
              onPick={form.readOnly ? undefined : handlePick}
              onPickAll={form.readOnly ? undefined : handlePickAll}
            />
            {picked.length === 0 && <p className="pd-lts-nosurface">{t("Labo:Spec:NoSurface")}</p>}
            {!form.readOnly && <p className="pd-lts-hint">{t("Labo:Spec:SurfaceHint")}</p>}
          </div>
          <LaboToothSurfacePanel
            fdi={fdi}
            context={context}
            value={value}
            active={active}
            onActive={setActive}
            onChange={update}
          />
        </div>
      )}
    </article>
  );
}
