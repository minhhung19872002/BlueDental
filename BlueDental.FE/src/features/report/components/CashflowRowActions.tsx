import { useCallback, useState } from "react";
import { Button, Space, Tooltip } from "antd";
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import { SALES_APPROVAL_STATUS } from "../api/financeApi";
import { notifyDemoAction } from "../api/reportMockQueries";
import type { SalesEntryVm } from "../types/mock";
import { RejectReasonModal } from "./RejectReasonModal";

interface Props {
  entry: SalesEntryVm;
  onEdit: (entry: SalesEntryVm) => void;
}

/** Row buttons for a thu/chi voucher. Every path ends in a demo toast — nothing is persisted. */
export function CashflowRowActions({ entry, onEdit }: Props) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isPending = entry.approvalStatus === SALES_APPROVAL_STATUS.Pending;

  const handleApprove = useCallback(() => notifyDemoAction(t("Duyệt phiếu {0}", entry.code)), [entry.code]);
  const handleEdit = useCallback(() => onEdit(entry), [onEdit, entry]);
  const openReject = useCallback(() => setRejectOpen(true), []);
  const closeReject = useCallback(() => setRejectOpen(false), []);
  const openDelete = useCallback(() => setDeleteOpen(true), []);
  const closeDelete = useCallback(() => setDeleteOpen(false), []);

  const handleReject = useCallback(() => {
    notifyDemoAction(t("Từ chối phiếu {0}", entry.code));
    setRejectOpen(false);
  }, [entry.code]);

  const handleDelete = useCallback(() => {
    notifyDemoAction(t("Xóa phiếu {0}", entry.code));
    setDeleteOpen(false);
  }, [entry.code]);

  return (
    <>
      <Space size={4}>
        {isPending && (
          <>
            <Tooltip title={t("Duyệt")}>
              <Button size="small" type="text" icon={<CheckOutlined />} className="report-action--approve" onClick={handleApprove} />
            </Tooltip>
            <Tooltip title={t("Từ chối")}>
              <Button size="small" type="text" danger icon={<CloseOutlined />} onClick={openReject} />
            </Tooltip>
          </>
        )}
        <Tooltip title={t("Chỉnh sửa")}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={handleEdit} />
        </Tooltip>
        <Tooltip title={t("Xóa")}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={openDelete} />
        </Tooltip>
      </Space>

      <RejectReasonModal open={rejectOpen} code={entry.code} onConfirm={handleReject} onClose={closeReject} />
      <ConfirmDeleteDialog
        open={deleteOpen}
        noun={t("phiếu")}
        name={entry.code}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </>
  );
}
