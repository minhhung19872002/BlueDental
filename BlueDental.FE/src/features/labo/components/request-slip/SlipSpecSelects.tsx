import { Select } from "antd";
import { t } from "@/lib/i18n";
import type { PickerOption } from "@/hooks/useLaboPickers";

export interface SlipSpec {
  rhythmId: string | undefined;
  biteId: string | undefined;
}

interface Props extends SlipSpec {
  rhythms: PickerOption[];
  bites: PickerOption[];
  editable: boolean;
  onChange: (patch: Partial<SlipSpec>) => void;
}

/**
 * The option a slip holds although Danh mục no longer lists it (deleted or
 * switched off since), so a sent order still reads its name.
 */
export function withHeldOption(options: PickerOption[], id: string | undefined, name: string | null | undefined) {
  if (!id || options.some((option) => option.value === id)) return options;
  return [...options, { value: id, label: name ?? id }];
}

/**
 * Kiểu nhịp and Khớp cắn under Đường hoàn tất (R-1216): the classic Đặt hàng
 * dropdowns, one value each for the whole order, both optional and clearable.
 */
export function SlipSpecSelects({ rhythms, bites, rhythmId, biteId, editable, onChange }: Props) {
  return (
    <div className="rs-spec">
      <div className="rs-spec-field">
        <span className="rs-lbl">{t("Patient:DentalChart:RhythmType")}</span>
        <Select
          className="rs-inp"
          value={rhythmId}
          options={rhythms}
          allowClear
          showSearch={{ optionFilterProp: "label" }}
          disabled={!editable}
          placeholder={t("Labo:Slip:Optional")}
          aria-label={t("Patient:DentalChart:RhythmType")}
          onChange={(next: string | undefined) => onChange({ rhythmId: next })}
        />
      </div>
      <div className="rs-spec-field">
        <span className="rs-lbl">{t("Patient:DentalChart:Occlusion")}</span>
        <Select
          className="rs-inp"
          value={biteId}
          options={bites}
          allowClear
          showSearch={{ optionFilterProp: "label" }}
          disabled={!editable}
          placeholder={t("Labo:Slip:Optional")}
          aria-label={t("Patient:DentalChart:Occlusion")}
          onChange={(next: string | undefined) => onChange({ biteId: next })}
        />
      </div>
    </div>
  );
}
