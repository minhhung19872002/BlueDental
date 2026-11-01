import { Select } from "antd";
import { teethCaption } from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { LaboWarrantyOption } from "./stageWarranty";

interface Props {
  options: LaboWarrantyOption[];
  value: string | undefined;
  locked: boolean;
  error?: string;
  onChange: (orderId: string) => void;
}

/** `R11, R21`, as the mock prints a Labo order's teeth; a whole jaw by its name (R-1098). */
const teethText = (teeth: number[]) => teethCaption(teeth, (tooth) => `R${tooth}`);

/** Line 1 the supplier, line 2 `{vật liệu} R11, R21 · Hạn dd/mm/yyyy` (G25; no "lượt", D5). */
function OptionText({ option }: { option: LaboWarrantyOption }) {
  const detail = [option.materialName, teethText(option.teeth)].filter(Boolean).join(" ");
  return (
    <span className="pd-wlabo-option">
      <strong>{option.supplierName ?? option.orderCode}</strong>
      <span>
        {detail && `${detail} · `}
        {t("Patient:Stage:WarrantyCardUntil", formatDate(option.until))}
      </span>
    </span>
  );
}

/**
 * "Dịch vụ bảo hành · Labo *" (P3110 REQ-F4, m394): the line's Labo orders in
 * this slip whose warranty is activated and still valid.
 */
export function StageLaboWarrantySelect({ options, value, locked, error, onChange }: Props) {
  const byId = new Map(options.map((option) => [option.orderId, option]));
  return (
    <div className="pd-wlabo-field">
      <p className="pd-wcards-label">
        {t("Patient:Stage:WarrantyLaboService")} <span className="floating-field-required">*</span>
      </p>
      <Select
        className="pd-wlabo-select"
        value={value}
        disabled={locked}
        status={error ? "error" : undefined}
        placeholder={t("Patient:Stage:WarrantyLaboPlaceholder")}
        options={options.map((option) => ({ value: option.orderId, label: option.orderCode }))}
        optionRender={(option) => {
          const held = byId.get(String(option.value));
          return held ? <OptionText option={held} /> : option.label;
        }}
        labelRender={(selected) => {
          const held = byId.get(String(selected.value));
          return held ? <OptionText option={held} /> : selected.label;
        }}
        onChange={onChange}
      />
      {error && <p className="pd-stage-error">{error}</p>}
    </div>
  );
}
