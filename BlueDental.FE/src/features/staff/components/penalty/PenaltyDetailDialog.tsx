import { Button, Descriptions, Modal } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { PENALTY_ACTION, type StaffPenaltyDto } from "../../api/staffPenaltyApi";
import { PENALTY_ACTION_LABEL } from "./penaltyConfig";
import { PenaltyStatusBadge } from "./PenaltyStatusBadge";

interface Props {
  penalty: StaffPenaltyDto | null;
  onClose: () => void;
}

const stamp = (value?: string | null) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "—");

/** Xem chi tiết — every field of one record, whatever its status, including who approved it and why it was cancelled. */
export function PenaltyDetailDialog({ penalty, onClose }: Props) {
  return (
    <Modal
      open={penalty !== null}
      title={<h2 className="bd-modal-title">{t("StaffPenalty:DetailTitle")}</h2>}
      width={560}
      destroyOnHidden
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t("Common:Close")}</Button>}
    >
      {penalty && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t("StaffPenalty:Field:Staff")}>{penalty.staffName ?? "—"}</Descriptions.Item>
          <Descriptions.Item label={t("StaffPenalty:Field:Date")}>{dayjs(penalty.violationDate).format("DD/MM/YYYY")}</Descriptions.Item>
          <Descriptions.Item label={t("StaffPenalty:Field:Type")}>{penalty.violationTypeName ?? "—"}</Descriptions.Item>
          <Descriptions.Item label={t("StaffPenalty:Field:Action")}>{t(PENALTY_ACTION_LABEL[penalty.action])}</Descriptions.Item>
          {penalty.action === PENALTY_ACTION.Fine && (
            <Descriptions.Item label={t("StaffPenalty:Col:Amount")}>{formatVND(penalty.fineAmount)} đ</Descriptions.Item>
          )}
          <Descriptions.Item label={t("StaffPenalty:Field:Description")}>{penalty.description ?? "—"}</Descriptions.Item>
          <Descriptions.Item label={t("Common:Status")}>
            <PenaltyStatusBadge penalty={penalty} />
          </Descriptions.Item>
          <Descriptions.Item label={t("StaffPenalty:Col:Creator")}>
            {penalty.creatorName ?? "—"} · {stamp(penalty.creationTime)}
          </Descriptions.Item>
          {penalty.approvedAt && (
            <Descriptions.Item label={t("StaffPenalty:Detail:ApprovedBy")}>
              {penalty.approverName ?? "—"} · {stamp(penalty.approvedAt)}
            </Descriptions.Item>
          )}
          {penalty.cancelReason && (
            <Descriptions.Item label={t("StaffPenalty:CancelReason")}>
              {penalty.cancelReason} · {stamp(penalty.cancelledAt)}
            </Descriptions.Item>
          )}
        </Descriptions>
      )}
    </Modal>
  );
}
