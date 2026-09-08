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
        <p>{t("Lựa chọn dịch vụ")}:</p>
        <Radio.Group
          value={mode}
          onChange={(event) => onMode(event.target.value as MaterialMode)}
          options={[
            { value: "old", label: t("Theo vật liệu cũ") },
            { value: "new", label: t("Thay đổi vật liệu mới") },
          ]}
        />
      </div>
      {mode === "old" ? (
        <div className="pd-labo-summary">
          <p>
            <b>{t("Dịch vụ hiện tại")}:</b> {parent.laboServiceName ?? "—"}
          </p>
          <p>
            <b>{t("Vật liệu")}:</b> {parent.materialName ?? "—"}
          </p>
        </div>
      ) : (
        <LaboMaterialStrips form={form} />
      )}
    </>
  );
}
