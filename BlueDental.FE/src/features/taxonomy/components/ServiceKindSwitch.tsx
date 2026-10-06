import { Segmented } from "antd";
import { t } from "@/lib/i18n";
import { SERVICE_KIND, type ServiceKind } from "../api/taxonomyApi";

interface Props {
  value?: ServiceKind;
  onChange?: (next: ServiceKind) => void;
  /** An entry keeps the kind it was created with; the server refuses a change. */
  disabled?: boolean;
}

/** "Loại: Dịch vụ lẻ | Combo" with the BA's hint beside it. */
export function ServiceKindSwitch({ value = SERVICE_KIND.Single, onChange, disabled }: Props) {
  return (
    <div className="bd-svc-kind">
      <span className="bd-svc-kind-label" id="bd-svc-kind-label">
        {t("Taxonomy:Combo:KindLabel")}
      </span>
      <Segmented<ServiceKind>
        aria-labelledby="bd-svc-kind-label"
        value={value}
        disabled={disabled}
        onChange={(next) => onChange?.(next)}
        options={[
          { value: SERVICE_KIND.Single, label: t("Taxonomy:Combo:KindSingle") },
          { value: SERVICE_KIND.Combo, label: t("Taxonomy:Combo:KindCombo") },
        ]}
      />
      <span className="bd-svc-kind-hint">{t("Taxonomy:Combo:KindHint")}</span>
    </div>
  );
}
