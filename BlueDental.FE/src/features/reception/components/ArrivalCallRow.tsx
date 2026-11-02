import React from "react";
import { Button } from "antd";
import { Clock3, FileText, Stethoscope, UserRound } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ArrivalCall, ArrivalCallAction } from "../types/arrivalCall";

interface ArrivalCallRowProps {
  item: ArrivalCall;
  action: ArrivalCallAction;
  canAct: boolean;
  pending: boolean;
  onAction: (id: string, action: ArrivalCallAction) => void;
}

const ACTION_LABEL_KEY: Record<ArrivalCallAction, string> = {
  invite: "Reception:ArrivalCallInvite",
  admit: "Reception:ArrivalCallAdmit",
};

export const ArrivalCallRow: React.FC<ArrivalCallRowProps> = ({ item, action, canAct, pending, onAction }) => {
  const calledUp = action === "invite" && item.invited;

  return (
    <li className="arrival-row">
      <div className="arrival-row-info">
        <div className="arrival-row-line arrival-row-name">
          <UserRound size={16} aria-hidden />
          <span>
            {item.patientName}
            {item.patientYearOfBirth ? ` (${item.patientYearOfBirth})` : ""}
          </span>
        </div>
        {/* Reception seats patients for every doctor, so it is told whose they are. */}
        {action === "admit" && item.doctorName && (
          <div className="arrival-row-line">
            <Stethoscope size={16} aria-hidden />
            <span>{item.doctorName}</span>
          </div>
        )}
        <div className="arrival-row-line">
          <Clock3 size={16} aria-hidden />
          <span>{item.time}</span>
        </div>
        {item.content && (
          <div className="arrival-row-line">
            <FileText size={16} aria-hidden />
            <span className="arrival-row-content">{item.content}</span>
          </div>
        )}
      </div>
      {calledUp && <span className="arrival-row-tag">{t("Reception:ArrivalCallInvitedTag")}</span>}
      {!calledUp && canAct && (
        <Button
          type="primary"
          ghost
          className="arrival-row-action"
          loading={pending}
          disabled={pending}
          onClick={() => onAction(item.id, action)}
        >
          {t(ACTION_LABEL_KEY[action])}
        </Button>
      )}
    </li>
  );
};
