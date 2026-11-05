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
  // A "Lịch tạm" is seated against a real record, so reception makes it first.
  const needsRecord = action === "admit" && item.isTemporary;
  const actionLabelKey = needsRecord ? "Reception:ArrivalCallCreateRecord" : ACTION_LABEL_KEY[action];

  return (
    <li className={["arrival-row", item.isFlagged && "bd-rgb-ring"].filter(Boolean).join(" ")}>
      <div className="arrival-row-info">
        <div className="arrival-row-line arrival-row-name">
          <UserRound size={16} aria-hidden />
          <span>
            {item.patientName}
            {item.patientYearOfBirth ? ` (${item.patientYearOfBirth})` : ""}
          </span>
          {item.isTemporary && <span className="arrival-row-temp">{t("Reception:StatusTemporary")}</span>}
        </div>
        {needsRecord && <div className="arrival-row-hint">{t("Reception:ArrivalCallNeedsRecord")}</div>}
        {/* Whose patient it is: reception seats for every doctor, an admin calls up for every doctor. */}
        <div className="arrival-row-line arrival-row-meta">
          <span>
            <Clock3 size={16} aria-hidden />
            {item.time}
          </span>
          {item.doctorName && (
            <span className="arrival-row-doctor">
              <Stethoscope size={16} aria-hidden />
              {item.doctorName}
            </span>
          )}
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
          {t(actionLabelKey)}
        </Button>
      )}
    </li>
  );
};
