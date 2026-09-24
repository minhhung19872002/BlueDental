import { Modal } from "antd";
import dayjs from "dayjs";
import { careTypeLabels, type CareRecordDto } from "@/features/cskh/api/careApi";
import { t } from "@/lib/i18n";

interface Props {
  record: CareRecordDto | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="pc-detail-row">
      <span className="pc-detail-label">{label}</span>
      <p className="pc-detail-value">{value}</p>
    </div>
  );
}

/** "CSKH Sau điều trị" — the group label, once, behind the reference's prefix. */
function careTitle(record: CareRecordDto): string {
  const label = careTypeLabels()[record.type];
  return label.startsWith("CSKH") ? label : `CSKH ${label}`;
}

/** "Chi tiết phiếu" — the read-only card behind the Nội dung column's link. */
export function CareDetailDialog({ record, onClose }: Props) {
  const at = record ? dayjs(record.dueAt ?? record.creationTime) : null;
  return (
    <Modal
      open={Boolean(record)}
      title={<h2 className="bd-modal-title">{t("Patient:Care:DetailTitle")}</h2>}
      onCancel={onClose}
      width={500}
      destroyOnHidden
      footer={null}
      className="app-dialog pc-detail-dialog"
    >
      {record ? (
        <>
          <Row label={t("Patient:Care:Title")} value={careTitle(record)} />
          <Row label={t("Patient:Care:Staff")} value={record.careStaffName ?? "-"} />
          <Row label={t("Patient:Care:DateTime")} value={at?.format("DD/MM/YYYY HH:mm:ss") ?? "-"} />
          <Row label={t("Patient:Care:NoteField")} value={record.description ?? "-"} />
        </>
      ) : null}
    </Modal>
  );
}
