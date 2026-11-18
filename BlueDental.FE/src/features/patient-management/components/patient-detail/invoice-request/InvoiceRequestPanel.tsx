import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import {
  INVOICE_REQUEST_STATUS,
  useInvoiceRequestStats,
  useInvoiceRequests,
  type InvoiceRequestDto,
  type InvoiceRequestScope,
} from "../../../api/invoiceRequestApi";
import { InvoiceRequestDetailDialog } from "./InvoiceRequestDetailDialog";
import { InvoiceRequestFormDialog } from "./InvoiceRequestFormDialog";
import { InvoiceRequestBanner, InvoiceRequestChips, InvoiceRequestHeader } from "./InvoiceRequestOverview";
import { InvoiceRequestWithdrawDialog } from "./InvoiceRequestWithdrawDialog";
import { buildInvoiceRequestColumns } from "./invoiceRequestColumns";
import type { InvoiceRequestFilter } from "./invoiceRequestStatus";
import { useInvoiceRequestWorkflow } from "./useInvoiceRequestWorkflow";
import "./invoice-request.css";

/** The chip turned into list parameters: "Cần xử lý" is Mới and Đã hủy at once. */
function filterParams(filter: InvoiceRequestFilter) {
  if (filter === "all") return {};
  if (filter === "open") return { openOnly: true };
  return { status: filter };
}

/**
 * "Yêu cầu xuất HĐ": what customers (by QR) or staff asked to invoice. On a
 * patient's Hóa đơn tab it is theirs and can be added to; under Tài chính ›
 * Hóa đơn đỏ it is every customer's of the branch, only to be worked (P1811).
 */
export function InvoiceRequestPanel({ scope }: { scope: InvoiceRequestScope }) {
  const patientId = "patientId" in scope ? scope.patientId : undefined;
  const [filter, setFilter] = useState<InvoiceRequestFilter>("all");
  const pagination = useTablePagination(20);
  const workflow = useInvoiceRequestWorkflow(patientId);

  const page = useInvoiceRequests({
    ...scope,
    ...filterParams(filter),
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const stats = useInvoiceRequestStats(scope);

  const handleFilter = (next: InvoiceRequestFilter) => {
    setFilter(next);
    pagination.resetToFirstPage();
  };

  const columns = buildInvoiceRequestColumns({
    now: Date.now(),
    onDetail: workflow.openDetail,
    showCustomer: !patientId,
    ...workflow.rowHandlers,
  });
  const reprocess = workflow.toProcess?.status === INVOICE_REQUEST_STATUS.Cancelled;

  return (
    <div className="ir-panel">
      {/* Hóa đơn đỏ carries its own page title. */}
      {patientId && <InvoiceRequestHeader onCreate={workflow.openCreate} />}
      <InvoiceRequestBanner stats={stats.data} onShowOpen={() => handleFilter("open")} />
      <InvoiceRequestChips value={filter} stats={stats.data} onChange={handleFilter} />
      <div className="bd-cat-card">
        <DataTable<InvoiceRequestDto>
          rowKey="id"
          loading={page.isLoading}
          columns={columns}
          dataSource={page.data?.items ?? []}
          scroll={{ x: patientId ? 1404 : 1572 }}
          locale={{ emptyText: t("Patient:InvoiceRequest:Empty") }}
          pagination={pagination.buildConfig(
            page.data?.totalCount ?? 0,
            countedTotal(t("Patient:InvoiceRequest:Unit")),
          )}
        />
      </div>
      <InvoiceRequestDetailDialog
        request={workflow.detail}
        onClose={workflow.closeDetail}
        {...(workflow.detail ? workflow.detailHandlers(workflow.detail) : { copying: false })}
      />
      <InvoiceRequestFormDialog target={workflow.form} onClose={workflow.closeForm} />
      <ConfirmDialog
        open={Boolean(workflow.toProcess)}
        title={t(reprocess ? "Patient:InvoiceRequest:Action:Reprocess" : "Patient:InvoiceRequest:Action:Process")}
        message={t("Patient:InvoiceRequest:ProcessConfirm", workflow.toProcess?.code ?? "")}
        pending={workflow.processing}
        onConfirm={workflow.handleProcess}
        onClose={workflow.closeProcess}
      />
      <InvoiceRequestWithdrawDialog
        request={workflow.toWithdraw}
        onClose={workflow.closeWithdraw}
        onDone={workflow.handleWithdrawn}
      />
    </div>
  );
}
