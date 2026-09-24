import { Select } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import {
  LABO_DETAIL_STATUS_OPTIONS,
  LABO_STATUS_CONFIG,
  type LaboStatus,
} from "@/features/labo/api/laboApi";

interface Props {
  value: LaboStatus;
  onChange: (status: LaboStatus) => void;
  /** Staging keeps the select on screen without `laboTemplate:update`, greyed. */
  disabled?: boolean;
}

/**
 * The "Trạng thái" select under the fourth block of the detail dialog: the
 * reference's five states, in its order, behind a floating label (staging,
 * 350×40, docs/clone/pages/labo.md §2.6). An order whose state is not among
 * the five (in flight on our side) is still shown by its own label.
 */
export function LaboStatusSelect({ value, onChange, disabled }: Props) {
  const keys = LABO_DETAIL_STATUS_OPTIONS.includes(value)
    ? LABO_DETAIL_STATUS_OPTIONS
    : [value, ...LABO_DETAIL_STATUS_OPTIONS];
  return (
    <FloatingLabel label={t("Patient:Misc:StatusLabel")} floated className="pd-labo-status">
      <Select<LaboStatus>
        value={value}
        options={keys.map((key) => ({ value: key, label: t(LABO_STATUS_CONFIG[key].label) }))}
        onChange={onChange}
        disabled={disabled}
        aria-label={t("Patient:Misc:StatusLabel")}
      />
    </FloatingLabel>
  );
}
