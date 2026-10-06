import { Button, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Ability } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { PENALTY_ACTION, PENALTY_STATUS, type StaffPenaltyDto } from "../../api/staffPenaltyApi";
import { PENALTY_ACTION_LABEL } from "./penaltyConfig";
import { PenaltyStatusBadge } from "./PenaltyStatusBadge";

export interface PenaltyRowHandlers {
  onView: (row: StaffPenaltyDto) => void;
  onEdit: (row: StaffPenaltyDto) => void;
  onDelete: (row: StaffPenaltyDto) => void;
  onApprove: (row: StaffPenaltyDto) => void;
  onCancel: (row: StaffPenaltyDto) => void;
}

/** One icon button of the Thao tác column. */
function RowButton(props: { label: string; icon: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <Tooltip title={props.label}>
      <Button type="text" size="small" aria-label={props.label} danger={props.danger} icon={props.icon} onClick={props.onClick} />
    </Tooltip>
  );
}

/**
 * Every row can be viewed. A draft can also be edited, approved, cancelled and
 * deleted; an approved record only cancelled; a cancelled one nothing more —
 * the same rule the server enforces.
 */
function RowButtons({ row, ability, handlers }: { row: StaffPenaltyDto; ability: Ability; handlers: PenaltyRowHandlers }) {
  const isDraft = row.status === PENALTY_STATUS.Draft;
  const isOpen = row.status !== PENALTY_STATUS.Cancelled;

  return (
    <div className="staff-penalty-actions">
      <RowButton label={t("StaffPenalty:View")} icon={<EyeOutlined />} onClick={() => handlers.onView(row)} />
      {isDraft && ability.canApprove && (
        <RowButton label={t("StaffPenalty:Approve")} icon={<CheckCircleOutlined />} onClick={() => handlers.onApprove(row)} />
      )}
      {isDraft && ability.canUpdate && (
        <RowButton label={t("Common:Edit")} icon={<EditOutlined />} onClick={() => handlers.onEdit(row)} />
      )}
      {isOpen && ability.canApprove && (
        <RowButton label={t("StaffPenalty:Cancel")} icon={<CloseCircleOutlined />} danger onClick={() => handlers.onCancel(row)} />
      )}
      {isDraft && ability.canDelete && (
        <RowButton label={t("Common:Delete")} icon={<DeleteOutlined />} danger onClick={() => handlers.onDelete(row)} />
      )}
    </div>
  );
}

export function penaltyColumns(ability: Ability, handlers: PenaltyRowHandlers): ColumnsType<StaffPenaltyDto> {
  return [
    {
      title: t("StaffPenalty:Col:Date"),
      dataIndex: "violationDate",
      width: 120,
      render: (value: string) => dayjs(value).format("DD/MM/YYYY"),
    },
    { title: t("StaffPenalty:Col:Staff"), dataIndex: "staffName", width: 180 },
    {
      title: t("StaffPenalty:Col:Type"),
      dataIndex: "violationTypeName",
      width: 160,
      render: (value?: string | null) => value ?? <span className="staff-penalty-muted">—</span>,
    },
    {
      title: t("StaffPenalty:Col:Action"),
      dataIndex: "action",
      width: 110,
      render: (value: StaffPenaltyDto["action"]) => t(PENALTY_ACTION_LABEL[value]),
    },
    {
      title: t("StaffPenalty:Col:Amount"),
      dataIndex: "fineAmount",
      width: 130,
      align: "right",
      render: (value: number, row) =>
        row.action === PENALTY_ACTION.Fine ? <span className="staff-penalty-amount">{formatVND(value)} đ</span> : "—",
    },
    { title: t("StaffPenalty:Col:Description"), dataIndex: "description", ellipsis: true },
    {
      title: t("Common:Status"),
      dataIndex: "status",
      width: 120,
      render: (_: unknown, row) => <PenaltyStatusBadge penalty={row} />,
    },
    { title: t("StaffPenalty:Col:Creator"), dataIndex: "creatorName", width: 150 },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 170,
      fixed: "right",
      render: (_: unknown, row) => <RowButtons row={row} ability={ability} handlers={handlers} />,
    },
  ];
}
