import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { STATUS_TONE } from "@/theme/statusPalette";
import { careTypeLabels, type CareType } from "../../api/careApi";
import { TEMPLATE_STATUS, type SmsMeasure, type TemplateStatus } from "../../api/templateApi";

interface StatusLook {
  label: () => string;
  bg: string;
  color: string;
}

const NEUTRAL = { bg: "var(--bd-bg-soft)", color: "var(--bd-muted)" };

/** Sẵn sàng reads green, Chờ duyệt amber and a refusal red, as the other status chips do. */
export const TEMPLATE_STATUS_LOOK: Record<TemplateStatus, StatusLook> = {
  [TEMPLATE_STATUS.Draft]: { label: () => t("CSKH:Template:Status:Draft"), ...NEUTRAL },
  [TEMPLATE_STATUS.Ready]: {
    label: () => t("CSKH:Template:Status:Ready"),
    bg: STATUS_TONE.arrived.bg,
    color: STATUS_TONE.arrived.color,
  },
  [TEMPLATE_STATUS.PendingApproval]: {
    label: () => t("CSKH:Template:Status:PendingApproval"),
    bg: STATUS_TONE.cancelled.bg,
    color: STATUS_TONE.cancelled.color,
  },
  [TEMPLATE_STATUS.Rejected]: {
    label: () => t("CSKH:Template:Status:Rejected"),
    bg: STATUS_TONE.late.bg,
    color: STATUS_TONE.late.color,
  },
  [TEMPLATE_STATUS.Disabled]: {
    label: () => t("CSKH:Template:Status:Disabled"),
    bg: NEUTRAL.bg,
    color: "var(--bd-faint)",
  },
};

/** Templates written before Mục đích existed carry none. */
export function purposeLabel(purpose: CareType | null): string {
  return purpose === null ? t("CSKH:Template:NoPurpose") : careTypeLabels()[purpose];
}

/** "148/160 ký tự · 1 tin SMS (không dấu)". */
export function smsMeasureLabel(measure: SmsMeasure): string {
  const key = measure.unicode ? "CSKH:Template:SmsMeasureUnicode" : "CSKH:Template:SmsMeasurePlain";
  return t(key, measure.characters, measure.perMessage, measure.segments);
}

export function lastUsedLabel(lastUsedAt: string | null): string {
  return lastUsedAt ? t("CSKH:Template:LastUsed", formatDate(lastUsedAt)) : t("CSKH:Template:NeverUsed");
}

/** Zalo's own review states of a ZNS template, worded as Công cụ ▸ Mẫu ZBS words them. */
const ZNS_STATUS_LABEL: Record<string, string> = {
  ENABLE: "Tools:ZaloTemplateEnabled",
  PENDING_REVIEW: "Tools:ZaloTemplatePending",
  REJECT: "Tools:ZaloTemplateRejected",
  DISABLE: "Tools:ZaloTemplateDisabled",
  DELETE: "Tools:ZaloTemplateDeleted",
};

export function znsStatusLabel(status: string | null): string {
  if (!status) return "—";
  const key = ZNS_STATUS_LABEL[status.toUpperCase()];
  return key ? t(key) : status;
}
