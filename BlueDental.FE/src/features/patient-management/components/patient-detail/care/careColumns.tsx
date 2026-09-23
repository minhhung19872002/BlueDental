import { Button, type TableColumnsType } from "antd";
import { Clock, Pencil, Trash2 } from "lucide-react";
import {
  careStatusLabels,
  careTypeLabels,
  type CareOutcome,
  type CareRecordDto,
  type CareStatus,
  type CareType,
} from "@/features/cskh/api/careApi";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { ratingOf } from "./careRating";

interface Handlers {
  onDetail: (row: CareRecordDto) => void;
  onEdit?: (row: CareRecordDto) => void;
  onDelete?: (row: CareRecordDto) => void;
}

/** Column set of the care log, in the reference's order and widths. */
export function buildCareColumns({
  onDetail,
  onEdit,
  onDelete,
}: Handlers): TableColumnsType<CareRecordDto> {
  const statusLabels = careStatusLabels();
  const typeLabels = careTypeLabels();
  return [
    {
      title: t("Patient:Care:Date"),
      dataIndex: "dueAt",
      width: 140,
      render: (value: string | null, row) => formatDate(value ?? row.creationTime),
    },
    {
      title: t("Patient:Care:Status"),
      dataIndex: "status",
      width: 140,
      render: (value: CareStatus) => (
        <span className="pc-status">
          <Clock size={14} aria-hidden />
          {statusLabels[value]}
        </span>
      ),
    },
    {
      title: t("Common:Group"),
      dataIndex: "type",
      width: 120,
      render: (value: CareType) => typeLabels[value],
    },
    {
      title: t("Common:Service"),
      dataIndex: "serviceNames",
      width: 160,
      render: (value: string[]) => value.join(", "),
    },
    {
      title: t("Common:Content"),
      dataIndex: "description",
      width: 220,
      render: (value: string | null, row) => (
        <div className="pc-content">
          <p className="pc-content-text">{value ?? ""}</p>
          <button type="button" className="pc-link" onClick={() => onDetail(row)}>
            {t("Common:Detail")}
          </button>
        </div>
      ),
    },
    {
      title: t("Patient:Care:TreatmentDoctor"),
      dataIndex: "assignedStaffName",
      width: 150,
      render: (value: string | null) => value ?? "",
    },
    {
      title: t("Patient:Care:Staff"),
      dataIndex: "careStaffName",
      width: 160,
      render: (value: string | null) => value ?? t("Patient:Debt:None"),
    },
    {
      title: t("Patient:Care:Rating"),
      dataIndex: "outcome",
      width: 130,
      render: (value: CareOutcome | null) => {
        const rating = ratingOf(value);
        return (
          <span className={`pc-rating pc-rating--${rating.tone}`}>
            <i className="pc-rating-dot" aria-hidden />
            {t(rating.label)}
          </span>
        );
      },
    },
    ...((onEdit || onDelete) ? [{
      title: t("Common:Actions"),
      key: "actions" as const,
      width: 70,
      fixed: "right" as const,
      render: (_: unknown, row: CareRecordDto) => (
        <div className="pc-actions">
          {onEdit && (
            <Button
              type="text"
              size="small"
              icon={<Pencil size={16} />}
              aria-label={t("Common:Edit")}
              onClick={() => onEdit(row)}
            />
          )}
          {onDelete && (
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={16} />}
              aria-label={t("Common:Delete")}
              onClick={() => onDelete(row)}
            />
          )}
        </div>
      ),
    }] : []),
  ];
}
