import { useMemo, useState } from "react";
import { Modal, Select, Table } from "antd";
import dayjs from "dayjs";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import {
  STAGE_CHANGE_ACTIONS,
  useStageChangeLogs,
  type StageChangeAction,
  type StageChangeLogDto,
} from "@/features/treatment-management/api/stageApi";
import { StageChangeLogDiff } from "./StageChangeLogDiff";
import { stageActionLabel, stageChangeLogColumns } from "./stageChangeLogColumns";
import "./stage-log.css";

/** Each công đoạn the log names, once, deleted ones included — the stage filter's options. */
function stageOptions(logs: StageChangeLogDto[]) {
  const seen = new Map<string, string>();
  for (const log of logs) {
    if (seen.has(log.treatmentStageId)) continue;
    const date = log.stageTreatmentDate ? `${dayjs(log.stageTreatmentDate).format("DD/MM/YYYY")} · ` : "";
    const gone = log.stageDeleted ? ` (${t("Patient:StageLog:StageDeleted")})` : "";
    seen.set(log.treatmentStageId, `${date}${log.stageName}${gone}`);
  }
  return [...seen].map(([value, label]) => ({ value, label }));
}

/** Mounted only while the dialog is open, so the log is fetched on demand. */
function StageChangeLogBody({ treatmentId }: { treatmentId: string }) {
  const [stageId, setStageId] = useState<string | undefined>();
  const [action, setAction] = useState<StageChangeAction | undefined>();
  const pagination = useTablePagination(20);
  const { data = [], isFetching } = useStageChangeLogs(treatmentId);

  const stages = useMemo(() => stageOptions(data), [data]);
  const rows = data.filter(
    (log) => (!stageId || log.treatmentStageId === stageId) && (!action || log.action === action),
  );

  const withReset =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      pagination.resetToFirstPage();
    };

  return (
    <div className="stage-log">
      <div className="stage-log__filters">
        <Select<string>
          className="stage-log__stage"
          allowClear
          showSearch={{ optionFilterProp: "label" }}
          placeholder={t("Patient:StageLog:AllStages")}
          aria-label={t("Patient:StageLog:Stage")}
          value={stageId}
          options={stages}
          onChange={withReset(setStageId)}
        />
        <Select<StageChangeAction>
          className="stage-log__action"
          allowClear
          placeholder={t("Patient:StageLog:AllActions")}
          aria-label={t("Patient:StageLog:Action")}
          value={action}
          options={STAGE_CHANGE_ACTIONS.map((value) => ({ value, label: stageActionLabel(value) }))}
          onChange={withReset(setAction)}
        />
      </div>
      <Table<StageChangeLogDto>
        className="stage-log__table"
        rowKey="id"
        size="middle"
        columns={stageChangeLogColumns()}
        dataSource={rows}
        loading={isFetching}
        scroll={{ x: "max-content" }}
        locale={{ emptyText: t("Patient:StageLog:Empty") }}
        expandable={{ expandedRowRender: (row) => <StageChangeLogDiff changes={row.changes} /> }}
        pagination={pagination.buildConfig(rows.length)}
      />
    </div>
  );
}

interface Props {
  /** The slip whose log is shown; null keeps the dialog shut. */
  treatmentId: string | null;
  onClose: () => void;
}

/**
 * "Lịch sử chỉnh sửa" of LỊCH SỬ ĐIỀU TRỊ — every logged change to the slip's
 * công đoạn, who made it and when, field by field (BA 2026-11-02: "hiển thị
 * lịch sử chỉnh sửa để admin có thể coi"). Admin only, like Xóa công đoạn.
 */
export function StageChangeLogDialog({ treatmentId, onClose }: Props) {
  return (
    <Modal
      open={treatmentId !== null}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={1080}
      className="app-dialog stage-log-modal"
      title={
        <div className="bd-modal-head">
          <div>
            <h2 className="bd-modal-title">{t("Patient:StageLog:Title")}</h2>
            <p className="bd-modal-subtitle">{t("Patient:StageLog:Subtitle")}</p>
          </div>
        </div>
      }
    >
      {treatmentId && <StageChangeLogBody treatmentId={treatmentId} />}
    </Modal>
  );
}
