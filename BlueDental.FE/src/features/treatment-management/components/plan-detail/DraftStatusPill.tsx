import { Dropdown } from "antd";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n";
import { SERVICE_LINE_STATUS, type TreatmentServiceStatus } from "../../api/treatmentPlanApi";
import { NEW_LINE_STATUSES } from "../plan/planTypes";

const STATUS_MODIFIER: Record<number, string> = {
  [SERVICE_LINE_STATUS.Created]: "",
  [SERVICE_LINE_STATUS.InProgress]: "pdt-status--converted",
  [SERVICE_LINE_STATUS.Done]: "pdt-status--done",
  [SERVICE_LINE_STATUS.Cancelled]: "pdt-status--cancelled",
  [SERVICE_LINE_STATUS.Replaced]: "pdt-status--converted",
  [SERVICE_LINE_STATUS.Warranty]: "pdt-status--converted",
  [SERVICE_LINE_STATUS.Transferred]: "pdt-status--converted",
};

interface Props {
  value: TreatmentServiceStatus;
  onChange: (value: TreatmentServiceStatus) => void;
}

/**
 * The status pill on the inline new row. Unlike a saved line it is a plain
 * choice of the seven statuses, in the reference's order, before the line
 * exists.
 */
export function DraftStatusPill({ value, onChange }: Props) {
  const current = NEW_LINE_STATUSES.find((status) => status.value === value) ?? NEW_LINE_STATUSES[0];
  const className = ["pdt-status", "pdt-status--menu", STATUS_MODIFIER[value]].filter(Boolean).join(" ");

  const handleClick = ({ key }: { key: string }) => {
    const picked = NEW_LINE_STATUSES.find((status) => String(status.value) === key);
    if (picked) onChange(picked.value);
  };

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: NEW_LINE_STATUSES.map((status) => ({ key: String(status.value), label: t(status.label) })),
        selectedKeys: [String(value)],
        onClick: handleClick,
      }}
    >
      <button type="button" className={className} aria-haspopup="menu" aria-label={t("Trạng thái dịch vụ mới")}>
        {t(current.label)}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </Dropdown>
  );
}
