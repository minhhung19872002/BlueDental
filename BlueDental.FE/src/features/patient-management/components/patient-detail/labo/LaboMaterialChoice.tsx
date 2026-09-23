import { Radio } from "antd";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboMaterialStrips } from "./LaboChipStrips";
import type { LaboOrderForm } from "./useLaboOrderForm";

export type MaterialMode = "old" | "new";

interface Props {
  parent: LaboOrderDto;
  mode: MaterialMode;
  onMode: (mode: MaterialMode) => void;
  form: LaboOrderForm;
}

/**
 * "Lựa chọn dịch vụ" on a child order: keep the parent's material, shown as
 * two summary lines, or open the chip strips and pick a new one.
 */
export function LaboMaterialChoice({ parent, mode, onMode, form }: Props) {
  return (
    <>
      <div className="pd-labo-radio">
        <p>{t("Patient:Quote:ServiceSelection")}:</p>
        <Radio.Group
          value={mode}
          onChange={(event) => onMode(event.target.value as MaterialMode)}
          options={[
            { value: "old", label: t("Patient:Labo:OldMaterial") },
            { value: "new", label: t("Patient:Labo:ChangeMaterial") },
          ]}
        />
      </div>
      {mode === "old" ? (
        <div className="pd-labo-summary">
          <p>
            <b>{t("Patient:Labo:CurrentService")}:</b> {parent.laboServiceName ?? "—"}
          </p>
          <p>
            <b>{t("Patient:Labo:Material")}:</b> {parent.materialName ?? "—"}
          </p>
        </div>
      ) : (
        <LaboMaterialStrips form={form} />
      )}
    </>
  );
}
