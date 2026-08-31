import { useMemo, useState } from "react";
import { Button, Tag, Tooltip } from "antd";
import { toast } from "sonner";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useCallAssignments,
  useDeleteCallAssignment,
  type CallAssignmentDto,
} from "../api/toolsApi";
import { CallAssignDialog } from "./CallAssignDialog";
import { activeTag, providerLabel } from "./callCatalog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { pagerTotal } from "@/utils/pagerTotal";

/** Phân Công Gọi — which SIP extension belongs to which staff member. */
export function CallAssignView() {
  const [dialog, setDialog] = useState<{ open: boolean; assignment: CallAssignmentDto | null }>({
    open: false,
    assignment: null,
  });
  const [pendingDelete, setPendingDelete] = useState<CallAssignmentDto | null>(null);

  const pagination = useTablePagination();

  const { data, isFetching } = useCallAssignments({
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const deleteAssignment = useDeleteCallAssignment();

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAssignment.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá phân công"));
    } catch {
      // queryClient reports the failure; nothing to add here.
    } finally {
      setPendingDelete(null);
    }
  };

  const columns = useMemo<ColumnsType<CallAssignmentDto>>(
    () => [
      {
        key: "sip",
        title: t("SIP"),
        width: 120,
        render: (_, assignment) => <span className="bd-cat-medium">{assignment.sip}</span>,
      },
      { key: "configuration", title: t("Cấu hình"), dataIndex: "configurationName" },
      { key: "staff", title: t("Nhân viên"), dataIndex: "staffName" },
      {
        key: "provider",
        title: t("Nhà cung cấp"),
        render: (_, assignment) => providerLabel(assignment.provider),
      },
      {
        key: "status",
        title: t("Trạng thái"),
        width: 130,
        render: (_, assignment) => {
          const { label, color } = activeTag(assignment.isActive);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 110,
        align: "center",
        render: (_, assignment) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Chỉnh sửa")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Chỉnh sửa SIP {0}", assignment.sip)}
                onClick={() => setDialog({ open: true, assignment })}
              />
            </Tooltip>
            <Tooltip title={t("Xoá")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Xoá SIP {0}", assignment.sip)}
                onClick={() => setPendingDelete(assignment)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <Button
          className="bd-tools-toolbar-end"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDialog({ open: true, assignment: null })}
        >
          {t("Tạo phân công")}
        </Button>
      </div>

      <DataTable<CallAssignmentDto>
        columns={columns}
        dataSource={data?.items ?? []}
        rowKey="id"
        loading={isFetching}
        pagination={pagination.buildConfig(data?.totalCount, pagerTotal)}
        // UNKNOWN_REFERENCE_BEHAVIOR: the reference's empty wording for this
        // list was not captured; this mirrors the configuration tab's phrasing.
        locale={{ emptyText: t("Chưa có phân công nào") }}
      />

      <CallAssignDialog
        open={dialog.open}
        assignment={dialog.assignment}
        onClose={() => setDialog({ open: false, assignment: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("phân công")}
        name={pendingDelete ? `SIP ${pendingDelete.sip}` : ""}
        pending={deleteAssignment.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
