import { Segmented } from "antd";
import { Layers } from "lucide-react";
import { t } from "@/lib/i18n";

export type ServiceKind = "single" | "combo";

interface Props {
  value: ServiceKind;
  onChange: (next: ServiceKind) => void;
  /** An entry already saved keeps its kind — the switch then only says which it is. */
  disabled?: boolean;
}

/**
 * "Loại: Dịch vụ lẻ | Combo" at the top of "Thêm dịch vụ" (review P0510):
 * Dịch vụ lẻ keeps the service form as it was, Combo swaps in the combo form.
 */
export function ServiceKindSwitch({ value, onChange, disabled }: Props) {
  return (
    <div className="bd-kind-switch">
      <span className="bd-kind-switch-label">{t("Taxonomy:Combo:Kind")}</span>
      <Segmented<ServiceKind>
        value={value}
        disabled={disabled}
        onChange={onChange}
        options={[
          { value: "single", label: t("Taxonomy:Combo:KindSingle") },
          {
            value: "combo",
            label: (
              <span className="bd-kind-switch-combo">
                <Layers size={14} aria-hidden="true" />
                {t("Taxonomy:Combo:KindCombo")}
              </span>
            ),
          },
        ]}
      />
      {value === "combo" && <span className="bd-kind-switch-hint">{t("Taxonomy:Combo:KindHint")}</span>}
    </div>
  );
}
