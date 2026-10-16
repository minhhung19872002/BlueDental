import { SERVICE_LINE_STATUS, type TreatmentServiceDto } from "../../api/treatmentPlanApi";
import { servicePills } from "../plan/planTypes";

const STATUS_MODIFIER: Record<number, string> = {
  [SERVICE_LINE_STATUS.Created]: "",
  [SERVICE_LINE_STATUS.InProgress]: "pdt-status--converted",
  [SERVICE_LINE_STATUS.Done]: "pdt-status--done",
  [SERVICE_LINE_STATUS.Cancelled]: "pdt-status--cancelled",
  [SERVICE_LINE_STATUS.Replaced]: "pdt-status--converted",
};

/**
 * The line's status pill — read only. Moving the line lives on
 * {@link ServiceStatusMenu} in Thao tác (owner 2026-10-15).
 */
export function ServiceStatusPill({ service }: { service: TreatmentServiceDto }) {
  const pills = servicePills();
  const pill = pills[service.status] ?? pills[SERVICE_LINE_STATUS.Created];
  const className = ["pdt-status", STATUS_MODIFIER[service.status]].filter(Boolean).join(" ");
  return <span className={className}>{pill.label}</span>;
}
