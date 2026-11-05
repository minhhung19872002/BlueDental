import { t } from "@/lib/i18n";
import type { LaboSpecMode } from "@/features/labo/api/laboApi";
import { sharesParams, sharesShade, specModeOf } from "./laboToothSpecs";
import { LaboToggle, type LaboToggleItem } from "./LaboToggle";

type Scope = "all" | "each";

interface Props {
  mode: LaboSpecMode;
  disabled: boolean;
  onChange: (mode: LaboSpecMode) => void;
}

/**
 * Thông số răng and Màu răng, each Chung tất cả răng / Riêng từng răng
 * (Labo v2 mock). Màu răng shows only while the parameters are shared;
 * sharing them again starts on a Màu per tooth.
 */
export function LaboSpecModeBar({ mode, disabled, onChange }: Props) {
  const items: LaboToggleItem<Scope>[] = [
    { key: "all", label: t("Labo:Spec:AllTeeth") },
    { key: "each", label: t("Labo:Spec:EachTooth") },
  ];
  const params = sharesParams(mode);
  const scopeOf = (shared: boolean): Scope => (shared ? "all" : "each");

  return (
    <div className="pd-lts-modebar">
      <div className="pd-lts-modegroup">
        <span className="pd-lts-modelabel">{t("Labo:Spec:ParamMode")}</span>
        <LaboToggle
          label={t("Labo:Spec:ParamMode")}
          items={items}
          value={scopeOf(params)}
          disabled={disabled}
          onChange={(scope) => onChange(specModeOf(scope === "all", false))}
        />
      </div>
      {params && (
        <div className="pd-lts-modegroup">
          <span className="pd-lts-modelabel">{t("Labo:Spec:ShadeMode")}</span>
          <LaboToggle
            label={t("Labo:Spec:ShadeMode")}
            items={items}
            value={scopeOf(sharesShade(mode))}
            disabled={disabled}
            onChange={(scope) => onChange(specModeOf(true, scope === "all"))}
          />
        </div>
      )}
    </div>
  );
}
