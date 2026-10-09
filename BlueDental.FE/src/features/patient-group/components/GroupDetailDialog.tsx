import { Button, Modal, Spin, Table, Tag } from "antd";
import { AlertOutlined, EditOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { GROUP_KIND, type PatientGroupDetailDto } from "../types";
import { memberColumns } from "./memberColumns";

interface Props {
  open: boolean;
  group: PatientGroupDetailDto | undefined;
  loading: boolean;
  /** Left out without patientGroup.update. */
  onEdit?: (group: PatientGroupDetailDto) => void;
  onClose: () => void;
}

/**
 * One group read in one place (4.10): the medical background its members
 * share, then each member's history, last visit, next appointment and debt.
 */
export function GroupDetailDialog({ open, group, loading, onEdit, onClose }: Props) {
  return (
    <Modal
      open={open}
      width="min(1200px, calc(100vw - 32px))"
      className="app-dialog pg-dialog"
      title={
        group ? (
          <span className="pg-detail-title">
            {group.name}
            <Tag color={group.kind === GROUP_KIND.Family ? "green" : "blue"}>
              {t(group.kind === GROUP_KIND.Family ? "PatientGroup:Kind:Family" : "PatientGroup:Kind:Other")}
            </Tag>
          </span>
        ) : (
          t("PatientGroup:DetailTitle")
        )
      }
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="pg-detail-foot">
          {group && onEdit ? (
            <Button icon={<EditOutlined />} onClick={() => onEdit(group)}>
              {t("Common:Edit")}
            </Button>
          ) : null}
          <Button onClick={onClose}>{t("Common:Close")}</Button>
        </div>
      }
    >
      {loading || !group ? (
        <div className="pg-loading">
          <Spin />
        </div>
      ) : (
        <div className="pg-detail">
          <section className="pg-medical">
            <h4>
              <AlertOutlined /> {t("PatientGroup:Field:SharedMedicalNote")}
            </h4>
            <p>{group.sharedMedicalNote ?? t("PatientGroup:NoSharedMedical")}</p>
            {group.note ? <small>{group.note}</small> : null}
          </section>
          <Table
            rowKey="patientId"
            size="small"
            pagination={false}
            scroll={{ x: 1120, y: 420 }}
            dataSource={group.members}
            columns={memberColumns(group.kind)}
          />
        </div>
      )}
    </Modal>
  );
}
