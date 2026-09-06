import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Pagination, Tooltip, type TableColumnsType } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  useDeletePrescription,
  usePrescriptions,
  type PrescriptionDto,
} from "../api/prescriptionApi";
import type { PrescriptionPatientSummary } from "../types/prescription";
import { PrescriptionDialog } from "./PrescriptionDialog";
import "./prescription.css";

/** The reference puts the open dialog in the URL, so a reload reopens it. */
const CREATE_PARAM = "create";

/** "Hiển thị 3 trên 3" — how many of the total are on this page. */
function shownOfTotal(total: number, range: [number, number]): string {
  return t("Hiển thị {0} trên {1}", total === 0 ? 0 : range[1] - range[0] + 1, total);
}

/**
 * The patient's Đơn thuốc tab: "Tạo đơn thuốc" over a table of the slips on
 * this branch, each with Sửa and Xóa, and the dialog both actions share.
 */
export function PrescriptionPanel({ patient }: { patient: PrescriptionPatientSummary }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<PrescriptionDto | null>(null);
  const [deleting, setDeleting] = useState<PrescriptionDto | null>(null);
  const query = usePrescriptions(patient.id);
  const remove = useDeletePrescription();
  const pagination = useTablePagination(20);

  const creating = searchParams.get(CREATE_PARAM) === "true";
  const setCreating = (next: boolean) =>
    setSearchParams(
      (current) => {
        if (next) current.set(CREATE_PARAM, "true");
        else current.delete(CREATE_PARAM);
        return current;
      },
      { replace: true },
    );

  const rows = query.data?.items ?? [];

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success(t("Đã xoá đơn thuốc"));
      setDeleting(null);
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  const columns: TableColumnsType<PrescriptionDto> = [
    { title: t("Mã đơn thuốc"), dataIndex: "code", width: 130 },
    {
      title: t("Bác sĩ"),
      dataIndex: "staffName",
      width: 180,
      ellipsis: true,
      render: (value: string | null) => value || "—",
    },
    {
      title: t("Chẩn đoán"),
      dataIndex: "diagnosisText",
      ellipsis: true,
      render: (value: string | null) => value || "—",
    },
    {
      title: t("Tái khám"),
      dataIndex: "followUpDate",
      width: 130,
      render: (value: string | null) => (value ? formatDate(value) : "—"),
    },
    {
      title: t("Ngày tạo"),
      dataIndex: "issuedAt",
      width: 130,
      render: (value: string) => formatDate(value),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 90,
      fixed: "right",
      render: (_, row) => (
        <span className="pd-icon-actions">
          <Tooltip title={t("Sửa")}>
            <Button type="text" aria-label={t("Sửa")} icon={<EditOutlined />} onClick={() => setEditing(row)} />
          </Tooltip>
          <Tooltip title={t("Xóa")}>
            <Button type="text" danger aria-label={t("Xóa")} icon={<DeleteOutlined />} onClick={() => setDeleting(row)} />
          </Tooltip>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="rx-toolbar">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          {t("Tạo đơn thuốc")}
        </Button>
      </div>
      <div className="bd-cat-card">
        <DataTable<PrescriptionDto>
          rowKey="id"
          loading={query.isLoading}
          columns={columns}
          dataSource={rows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize)}
          locale={{ emptyText: t("Không có dữ liệu") }}
          pagination={pagination.buildConfig(rows.length, shownOfTotal)}
        />
        {rows.length === 0 && !query.isLoading && (
          // antd drops the pager from an empty table; the reference keeps
          // "Hiển thị 0 trên 0" with Trước/Sau under it.
          <div className="rx-empty-pager">
            <Pagination {...pagination.buildConfig(0, shownOfTotal)} />
          </div>
        )}
      </div>

      <PrescriptionDialog
        open={creating || Boolean(editing)}
        patient={patient}
        prescription={editing}
        onClose={() => {
          setEditing(null);
          if (creating) setCreating(false);
        }}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleting)}
        noun={t("đơn thuốc")}
        name={deleting?.code}
        pending={remove.isPending}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
