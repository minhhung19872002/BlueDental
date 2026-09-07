import { Dropdown, type MenuProps } from "antd";
import { ChevronDown } from "lucide-react";
import { t } from "@/lib/i18n";
import { SERVICE_LINE_STATUS, type TreatmentServiceDto } from "../../api/treatmentPlanApi";
import { SERVICE_PILL } from "../plan/planTypes";
import { isLineOpen } from "./planDetailTypes";

/** What the status menu offers on an open line. */
export type ServiceAction = "complete" | "convert" | "cancel";

const STATUS_MODIFIER: Record<number, string> = {
  [SERVICE_LINE_STATUS.Created]: "",
  [SERVICE_LINE_STATUS.InProgress]: "pdt-status--converted",
  [SERVICE_LINE_STATUS.Done]: "pdt-status--done",
  [SERVICE_LINE_STATUS.Cancelled]: "pdt-status--cancelled",
  [SERVICE_LINE_STATUS.Replaced]: "pdt-status--converted",
};

/** Menu entries in the reference's order; keys are the actions. */
function menuItems(): MenuProps["items"] {
  return [
    { key: "complete", label: t("Hoàn thành") },
    { key: "convert", label: t("Chuyển đổi") },
    { key: "cancel", label: t("Hủy dịch vụ"), danger: true },
  ];
}

interface Props {
  service: TreatmentServiceDto;
  onAction: (action: ServiceAction) => void;
}

/**
 * The status pill under the service name. On a line that can still move it
 * is a menu button (chevron, aria-haspopup); a finished line is plain text.
 */
export function ServiceStatusPill({ service, onAction }: Props) {
  const pill = SERVICE_PILL[service.status] ?? SERVICE_PILL[SERVICE_LINE_STATUS.Created];
  const className = ["pdt-status", STATUS_MODIFIER[service.status]].filter(Boolean).join(" ");

  if (!isLineOpen(service)) {
    return <span className={className}>{t(pill.label)}</span>;
  }

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: menuItems(),
        onClick: ({ key }) => onAction(key as ServiceAction),
      }}
    >
      <button
        type="button"
        className={`${className} pdt-status--menu`}
        aria-haspopup="menu"
        aria-label={t("Trạng thái dịch vụ {0}", service.serviceName ?? service.code)}
      >
        {t(pill.label)}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </Dropdown>
  );
}
