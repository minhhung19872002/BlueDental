import { Dropdown, type MenuProps } from "antd";
import { ListChecks } from "lucide-react";
import { ActionTooltip } from "@/components/ActionTooltip";
import { t } from "@/lib/i18n";
import type { TreatmentServiceDto } from "../../api/treatmentPlanApi";

/** What the status menu offers on an open line. */
export type ServiceAction = "complete" | "convert" | "cancel";

/** Menu entries in the reference's order; keys are the actions. */
function menuItems(converts: boolean): MenuProps["items"] {
  return [
    { key: "complete", label: t("Treatment:Service:StatusDone") },
    ...(converts ? [{ key: "convert", label: t("Treatment:Convert:Convert") }] : []),
    { key: "cancel", label: t("Treatment:Service:CancelService"), danger: true },
  ];
}

interface Props {
  service: TreatmentServiceDto;
  onAction: (action: ServiceAction) => void;
  /** The trigger's class — the table's icon button or the card head's. */
  buttonClassName: string;
  /** Whether "Chuyển đổi" is offered; it is not on a line whose money is masked. */
  converts: boolean;
}

/**
 * "Đổi trạng thái" in Thao tác: Hoàn thành / Chuyển đổi / Hủy dịch vụ on a
 * line that can still move. The caller decides whether the line may.
 */
export function ServiceStatusMenu({ service, onAction, buttonClassName, converts }: Props) {
  const label = t("Treatment:Service:ChangeStatus");
  return (
    <ActionTooltip title={label}>
      <Dropdown
        trigger={["click"]}
        menu={{
          items: menuItems(converts),
          onClick: ({ key }) => onAction(key as ServiceAction),
        }}
      >
        <button
          type="button"
          className={`${buttonClassName} pdt-status-trigger`}
          aria-haspopup="menu"
          aria-label={`${label} — ${service.serviceName ?? service.code}`}
        >
          <ListChecks size={16} aria-hidden="true" />
        </button>
      </Dropdown>
    </ActionTooltip>
  );
}
