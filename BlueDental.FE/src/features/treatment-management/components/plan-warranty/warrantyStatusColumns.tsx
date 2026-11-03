import type { TableColumnsType } from "antd";
import { FlaskConical, Shield } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatCardDate } from "@/features/labo/components/warranty/laboWarrantyRules";
import {
  WARRANTY_CELL,
  WARRANTY_ROW_GROUP,
  type WarrantyCellState,
  type WarrantyServiceRowDto,
} from "../../api/planWarrantyApi";
import { serviceLineStatusConfig } from "../../api/treatmentPlanApi";
import { serviceTitle } from "./planWarrantyView";

export interface StatusActions {
  canActivate: boolean;
  canLabo: boolean;
  onDental: (row: WarrantyServiceRowDto) => void;
  onLabo: (row: WarrantyServiceRowDto) => void;
  onCards: (row: WarrantyServiceRowDto) => void;
}

const CELL_TONE: Record<WarrantyCellState, string> = {
  [WARRANTY_CELL.None]: "",
  [WARRANTY_CELL.NotEligible]: "muted",
  [WARRANTY_CELL.Pending]: "pending",
  [WARRANTY_CELL.Activated]: "active",
};

/** Chờ kích hoạt · Đã kích hoạt · n thẻ · Chưa đủ điều kiện, or "–" when the line has no such warranty. */
function WarrantyCell({ state, cards }: { state: WarrantyCellState; cards: number }) {
  if (state === WARRANTY_CELL.None) return <span className="pwt-none">–</span>;
  const label = {
    [WARRANTY_CELL.NotEligible]: t("Treatment:Warranty:Cell:NotEligible"),
    [WARRANTY_CELL.Pending]: t("Labo:Warranty:AwaitingActivation"),
    [WARRANTY_CELL.Activated]: t("Treatment:Warranty:Cell:Activated", cards),
  }[state];
  return <span className={`pwt-pill pwt-pill--${CELL_TONE[state]}`}>{label}</span>;
}

function ServiceCell({ row }: { row: WarrantyServiceRowDto }) {
  return (
    <div className="pwt-stack">
      <strong className="pwt-service">{serviceTitle(row)}</strong>
      {row.dentistName && <span className="pwt-sub">{t("Treatment:Warranty:Dentist", row.dentistName)}</span>}
      {row.laboOrderCodes.map((code) => (
        <span key={code} className="pwt-sub">
          {code}
        </span>
      ))}
    </div>
  );
}

/** "Đã lắp 05/11/2026" / "Hoàn thành …" (+ orange Chờ kích hoạt), or the line's state and its current công đoạn. */
function DoneCell({ row }: { row: WarrantyServiceRowDto }) {
  if (row.completedOn) {
    const key = row.laboFitted ? "Treatment:Warranty:FittedOn" : "Treatment:Warranty:CompletedOn";
    return (
      <div className="pwt-stack">
        <span>{t(key, formatCardDate(row.completedOn))}</span>
        {row.group === WARRANTY_ROW_GROUP.Ready && (
          <span className="pwt-sub pwt-sub--pending">{t("Labo:Warranty:AwaitingActivation")}</span>
        )}
      </div>
    );
  }
  return (
    <div className="pwt-stack">
      <span>{serviceLineStatusConfig()[row.status].label}</span>
      {row.currentStageNumber != null && (
        <span className="pwt-sub">
          {t("Treatment:Warranty:CurrentStage", row.currentStageNumber, row.currentStageName ?? "")}
        </span>
      )}
    </div>
  );
}

function ActionsCell({ row, actions }: { row: WarrantyServiceRowDto; actions: StatusActions }) {
  const dental = actions.canActivate && row.dental === WARRANTY_CELL.Pending;
  const labo = actions.canLabo && row.labo === WARRANTY_CELL.Pending && Boolean(row.pendingLaboOrderId);
  const hasCards = row.dentalCardCount + row.laboCardCount > 0;
  return (
    <div className="pwt-actions">
      {dental && (
        <button type="button" className="pwt-action pwt-action--dental" onClick={() => actions.onDental(row)}>
          <Shield size={14} aria-hidden="true" />
          {t("Patient:Stage:ServiceWarranty")}
        </button>
      )}
      {labo && (
        <button type="button" className="pwt-action pwt-action--labo" onClick={() => actions.onLabo(row)}>
          <FlaskConical size={14} aria-hidden="true" />
          {t("Treatment:Warranty:LaboWarranty")}
        </button>
      )}
      {!dental && !labo && hasCards && (
        <button type="button" className="pwt-link" onClick={() => actions.onCards(row)}>
          {t("Treatment:Warranty:ViewCards")}
        </button>
      )}
    </div>
  );
}

export function warrantyStatusColumns(actions: StatusActions): TableColumnsType<WarrantyServiceRowDto> {
  return [
    { key: "service", title: t("Treatment:Warranty:Col:Service"), width: 300, render: (_, row) => <ServiceCell row={row} /> },
    { key: "done", title: t("Treatment:Warranty:Col:Done"), width: 170, render: (_, row) => <DoneCell row={row} /> },
    {
      key: "dental",
      title: (
        <span className="pwt-head pwt-head--dental">
          <Shield size={14} aria-hidden="true" />
          {t("Treatment:Warranty:Col:Dental")}
        </span>
      ),
      width: 200,
      render: (_, row) => <WarrantyCell state={row.dental} cards={row.dentalCardCount} />,
    },
    {
      key: "labo",
      title: (
        <span className="pwt-head pwt-head--labo">
          <FlaskConical size={14} aria-hidden="true" />
          {t("Treatment:Warranty:Col:Labo")}
        </span>
      ),
      width: 200,
      render: (_, row) => <WarrantyCell state={row.labo} cards={row.laboCardCount} />,
    },
    {
      key: "actions",
      title: t("Common:Actions"),
      width: 200,
      fixed: "right",
      render: (_, row) => <ActionsCell row={row} actions={actions} />,
    },
  ];
}
