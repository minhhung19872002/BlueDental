import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useDeleteVoucher,
  usePublishVoucher,
  useUnpublishVoucher,
  useVouchers,
  type VoucherDto,
} from "../api/voucherApi";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import { useBranchFilter } from "@/lib/clinicBranch";
import { useAbility } from "@/hooks/useAbility";
import { PageHeader } from "@/components/PageHeader";
import { VoucherToolbar } from "../components/VoucherToolbar";
import { VoucherTable } from "../components/VoucherTable";
import { VoucherCreateDialog } from "../components/VoucherCreateDialog";
import { VoucherEditDialog } from "../components/VoucherEditDialog";
import "../components/voucher.css";

export function VoucherPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherDto | null>(null);

  const branchId = useBranchFilter();
  const ability = useAbility("voucher");
  const { data: page, isLoading } = useVouchers(
    statusFilter || undefined,
    keyword,
    branchId,
  );

  const publishVoucher = usePublishVoucher();
  const unpublishVoucher = useUnpublishVoucher();
  const deleteVoucher = useDeleteVoucher();

  const run = useCallback(
    async (action: Promise<unknown>, successMessage: string) => {
      try {
        await action;
        toast.success(successMessage);
      } catch (error) {
        notifyError(extractApiError(error));
      }
    },
    [],
  );

  const handlePublish = useCallback(
    (id: string) => run(publishVoucher.mutateAsync(id), t("Đã hiển thị voucher")),
    [publishVoucher, run],
  );

  const handleUnpublish = useCallback(
    (id: string) => run(unpublishVoucher.mutateAsync(id), t("Đã ẩn voucher")),
    [unpublishVoucher, run],
  );

  const handleDelete = useCallback(
    (id: string) => run(deleteVoucher.mutateAsync(id), t("Đã xoá voucher")),
    [deleteVoucher, run],
  );

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Voucher khuyến mãi")}
        subtitle={t("Voucher mới luôn ở trạng thái Nháp — phải kích hoạt mới dùng được")}
      />

      <div className="reception-card reception-card--toolbar">
        <VoucherToolbar
          keyword={keyword}
          statusFilter={statusFilter}
          onKeywordChange={setKeyword}
          onStatusFilterChange={setStatusFilter}
          onCreateClick={ability.canCreate ? () => setCreateOpen(true) : undefined}
        />
      </div>

      <div className="reception-card reception-card--content">
        <VoucherTable
          data={page?.items ?? []}
          loading={isLoading}
          onPublish={ability.canUpdate ? handlePublish : undefined}
          onUnpublish={ability.canUpdate ? handleUnpublish : undefined}
          onEdit={ability.canUpdate ? setEditing : undefined}
          onDelete={ability.canDelete ? handleDelete : undefined}
        />
      </div>

      <VoucherCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <VoucherEditDialog
        voucher={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
