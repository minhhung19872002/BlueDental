import { StatusBadge } from "@/components/StatusBadge";
import type { TemplateStatus } from "../../api/templateApi";
import { TEMPLATE_STATUS_LOOK } from "./templateLook";

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  const look = TEMPLATE_STATUS_LOOK[status];
  return <StatusBadge label={look.label()} bg={look.bg} color={look.color} />;
}
