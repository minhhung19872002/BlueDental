import React from "react";
import { Button } from "antd";
import { Clock3, FileText, Stethoscope, UserRound } from "lucide-react";
import { StaffLabelBadge } from "@/components/LabelColor";
import { t } from "@/lib/i18n";
import { useWaitClock } from "../hooks/useWaitState";
import type { ArrivalCall, ArrivalCallAction } from "../types/arrivalCall";
import { FLAG_PENNANT_SRC } from "../utils/flagPennant";
import { ArrivalPunctualityBadge } from "./ArrivalPunctualityBadge";
import { WaitTimerChip } from "./WaitTimerChip";

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
  // Every row is arrived and not yet in the chair: the same clock as the card's (R-1156).
  const wait = useWaitClock({ checkedInAt: item.checkedInAt, cancelled: false });

  return (
    <li className={["arrival-row", item.isFlagged && "bd-rgb-ring"].filter(Boolean).join(" ")}>
      {item.isFlagged && <img className="arrival-row-flag" src={FLAG_PENNANT_SRC} alt={t("Reception:Flagged")} />}
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
        {/* Whose patient it is: reception seats for every doctor, a doctor calls up for every doctor shown. */}
        <div className="arrival-row-line arrival-row-meta">
          <span>
            <Clock3 size={16} aria-hidden />
            {item.time}
            {item.punctuality && (
              <ArrivalPunctualityBadge
                punctuality={item.punctuality}
                bookedTime={item.time}
                arrivedTime={item.arrivedTime}
              />
            )}
          </span>
          {item.doctorName && (
            <span className="arrival-row-doctor">
              <Stethoscope size={16} aria-hidden />
              <StaffLabelBadge color={item.doctorLabelColor}>{item.doctorName}</StaffLabelBadge>
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
      <div className="arrival-row-side">
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
        {wait.kind === "waiting" && <WaitTimerChip level={wait.level} elapsedSeconds={wait.elapsedSeconds} />}
      </div>
    </li>
  );
};
