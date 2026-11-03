import { Button, Tooltip } from "antd";
import { ActionTooltip } from "@/components/ActionTooltip";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import type { WarrantyState } from "./stageModel";

/** lucide-briefcase-medical, the reference's warranty glyph. */
export function BriefcaseMedicalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 11v4" />
      <path d="M14 13h-4" />
      <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M18 6v14" />
      <path d="M6 6v14" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}

/**
 * The warranty control's tooltip: "Bảo hành đến dd/mm/yyyy" when the line's
 * valid cards are known, else where the button leads; "Không bảo hành" on a
 * line without one.
 */
export function warrantyTitle(state: WarrantyState): string {
  switch (state.kind) {
    case "available":
      return state.until
        ? t("Patient:Stage:WarrantyUntil", formatDate(state.until))
        : t("Patient:Stage:WarrantyOpenTab");
    case "noWarranty":
    case "none":
      return t("Patient:Labo:NoWarranty");
  }
}

interface Props {
  state: WarrantyState;
  onClick: () => void;
}

/**
 * The warranty control of a finished LỊCH SỬ ĐIỀU TRỊ row, as the reference
 * draws it (its HistorySection, 2026-09-24): a grey disabled "Không bảo hành"
 * when the line carries no warranty, otherwise a green "Bảo hành dịch vụ" that
 * opens the slip's Bảo hành tab (P3110 REQ-A9). Nothing at all on a row that
 * is not finished.
 */
export function StageWarrantyButton({ state, onClick }: Props) {
  if (state.kind === "none") return null;

  if (state.kind === "noWarranty") {
    return (
      <Tooltip title={warrantyTitle(state)}>
        {/* A disabled button gets no hover of its own; the span takes it. */}
        <span className="pd-stage-warrantywrap">
          <Button block disabled className="pd-stage-nowarranty" icon={<BriefcaseMedicalIcon />}>
            {t("Patient:Labo:NoWarranty")}
          </Button>
        </span>
      </Tooltip>
    );
  }

  // ActionTooltip shuts the tip on press, so it does not linger over the tab
  // the button opens.
  return (
    <ActionTooltip title={warrantyTitle(state)} className="pd-stage-warrantywrap">
      <Button
        block
        type="primary"
        className="pd-stage-warranty"
        icon={<BriefcaseMedicalIcon />}
        onClick={onClick}
      >
        {t("Patient:Stage:ServiceWarranty")}
      </Button>
    </ActionTooltip>
  );
}
