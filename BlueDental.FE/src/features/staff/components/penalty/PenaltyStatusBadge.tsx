import { Tooltip } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { PENALTY_STATUS, type StaffPenaltyDto } from "../../api/staffPenaltyApi";
import { PENALTY_STATUS_CONFIG } from "./penaltyConfig";

interface Props {
  penalty: StaffPenaltyDto;
}

/** The status pill; hovering an approved or cancelled one says who and why. */
export function PenaltyStatusBadge({ penalty }: Props) {
  const { label, tone } = PENALTY_STATUS_CONFIG[penalty.status];
  const pill = <span className={`staff-penalty-pill staff-penalty-pill--${tone}`}>{t(label)}</span>;

  const hint =
    penalty.status === PENALTY_STATUS.Approved && penalty.approvedAt
      ? t("StaffPenalty:ApprovedBy", penalty.approverName ?? "", dayjs(penalty.approvedAt).format("DD/MM/YYYY HH:mm"))
      : penalty.status === PENALTY_STATUS.Cancelled && penalty.cancelReason
        ? t("StaffPenalty:CancelledBecause", penalty.cancelReason)
        : null;

  return hint ? <Tooltip title={hint}>{pill}</Tooltip> : pill;
}
