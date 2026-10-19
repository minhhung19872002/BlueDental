import type { ReactNode } from "react";
import { Button, Table, type TablePaginationConfig, type TableColumnsType } from "antd";
import { CopyOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { ActionTooltip } from "@/components/ActionTooltip";
import { EmptyState } from "@/components/EmptyState";
import { useT } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import type { StaffNoteDto } from "../types";

interface Props {
  notes: StaffNoteDto[];
  loading: boolean;
  /** "Chung" names who wrote each note and when; on "Cá nhân" it is always the viewer. */
  showAuthor: boolean;
  pagination: TablePaginationConfig;
  onEdit: (note: StaffNoteDto) => void;
  onDelete: (note: StaffNoteDto) => void;
  onCopy: (note: StaffNoteDto) => void;
}

/** STT / Nội dung / Thao tác. Sửa and Xóa belong to the author; Copy is everybody's. */
export function StaffNoteTable({ notes, loading, showAuthor, pagination, onEdit, onDelete, onCopy }: Props) {
  const t = useT();
  const firstIndex = ((pagination.current ?? 1) - 1) * (pagination.pageSize ?? notes.length);

  const action = (label: string, icon: ReactNode, onClick: () => void, danger = false) => (
    <ActionTooltip title={label} className="staff-notes-tip">
      <Button type="text" size="small" danger={danger} aria-label={label} icon={icon} onClick={onClick} />
    </ActionTooltip>
  );

  const columns: TableColumnsType<StaffNoteDto> = [
    {
      title: t("StaffNote:Column:Index"),
      key: "index",
      // bd-col-icon lifts the global 100px header floor; the width is in the CSS, per breakpoint.
      className: "staff-notes-index bd-col-icon",
      align: "center",
      render: (_value, _note, index) => firstIndex + index + 1,
    },
    {
      title: t("StaffNote:Column:Content"),
      key: "content",
      render: (_value, note) => (
        <div className="staff-notes-cell">
          <div className="staff-notes-text" title={note.content}>
            {note.content}
          </div>
          {showAuthor && (
            <div className="staff-notes-byline">
              {t("StaffNote:ByLine", note.creatorName ?? "", formatDateTime(note.creationTime))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t("StaffNote:Column:Actions"),
      key: "actions",
      width: 120,
      align: "center",
      render: (_value, note) => (
        <div className="bd-cat-rowactions">
          {note.canEdit && action(t("StaffNote:Action:Edit"), <EditOutlined />, () => onEdit(note))}
          {note.canEdit && action(t("StaffNote:Action:Delete"), <DeleteOutlined />, () => onDelete(note), true)}
          {action(t("StaffNote:Action:Copy"), <CopyOutlined />, () => onCopy(note))}
        </div>
      ),
    },
  ];

  return (
    <Table<StaffNoteDto>
      className="staff-notes-table"
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={notes}
      loading={loading}
      pagination={pagination}
      locale={{ emptyText: <EmptyState title={t("StaffNote:Empty")} /> }}
    />
  );
}
