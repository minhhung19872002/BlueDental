import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import type { StageChangeAction, StageChangeLogDto } from "@/features/treatment-management/api/stageApi";

/** Pill colour per logged action — the nine TreatmentStageChangeAction values. */
const ACTION_TONE: Record<StageChangeAction, string> = {
  1: "blue",
  2: "blue",
  3: "amber",
  4: "green",
  5: "amber",
  6: "purple",
  7: "orange",
  8: "red",
  9: "amber",
};

export const stageActionLabel = (action: StageChangeAction) => t(`Patient:StageLog:Action:${action}`);

export function StageActionPill({ action }: { action: StageChangeAction }) {
  return <span className={`stage-log-pill stage-log-pill--${ACTION_TONE[action]}`}>{stageActionLabel(action)}</span>;
}

/** "20/10/2026 · Niềng răng", and "Đã xóa" once the row is gone. */
export function StageLogStage({ row }: { row: StageChangeLogDto }) {
  return (
    <span className="stage-log-stage">
      {row.stageTreatmentDate && <b>{dayjs(row.stageTreatmentDate).format("DD/MM/YYYY")}</b>}
      <span>{row.stageName}</span>
      {row.stageDeleted && (
        <span className="stage-log-pill stage-log-pill--red">{t("Patient:StageLog:StageDeleted")}</span>
      )}
    </span>
  );
}

export function stageChangeLogColumns(): ColumnsType<StageChangeLogDto> {
  return [
    {
      title: t("Patient:StageLog:Time"),
      dataIndex: "occurredAt",
      width: 136,
      render: (value: string) => <span className="stage-log-nowrap">{dayjs(value).format("DD/MM/YYYY HH:mm")}</span>,
    },
    {
      title: t("Patient:StageLog:Stage"),
      dataIndex: "stageName",
      width: 260,
      render: (_, row) => <StageLogStage row={row} />,
    },
    {
      title: t("Patient:StageLog:Action"),
      dataIndex: "action",
      width: 176,
      render: (action: StageChangeAction) => <StageActionPill action={action} />,
    },
    {
      title: t("Patient:StageLog:Fields"),
      dataIndex: "changes",
      width: 220,
      render: (_, row) => row.changes.map((c) => t(`Patient:StageLog:Field:${c.field}`)).join(", ") || "—",
    },
    {
      title: t("Patient:StageLog:Actor"),
      dataIndex: "actorName",
      width: 180,
      render: (name: string | null) => name ?? t("Patient:StageLog:System"),
    },
  ];
}
