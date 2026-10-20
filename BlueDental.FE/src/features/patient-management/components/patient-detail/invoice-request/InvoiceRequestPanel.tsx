import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import {
  useInvoiceRequestStats,
  useInvoiceRequests,
  type InvoiceRequestDto,
} from "../../../api/invoiceRequestApi";
import { InvoiceRequestActionDialog } from "./InvoiceRequestActionDialog";
import { InvoiceRequestDetailDialog } from "./InvoiceRequestDetailDialog";
import { InvoiceRequestFormDialog } from "./InvoiceRequestFormDialog";
import { InvoiceRequestBanner, InvoiceRequestChips, InvoiceRequestHeader } from "./InvoiceRequestOverview";
import { buildInvoiceRequestColumns } from "./invoiceRequestColumns";
import type { InvoiceRequestFilter } from "./invoiceRequestStatus";
import { useInvoiceRequestWorkflow } from "./useInvoiceRequestWorkflow";
import "./invoice-request.css";

/** The chip turned into list parameters: "Cần xử lý" is every open status at once. */
function filterParams(filter: InvoiceRequestFilter) {
  if (filter === "all") return {};
  if (filter === "open") return { openOnly: true };
  return { status: filter };
}

/** "Yêu cầu xuất HĐ": what customers (by QR) or staff asked the accountant to invoice. */
export function InvoiceRequestPanel({ patientId }: { patientId: string }) {
  const [filter, setFilter] = useState<InvoiceRequestFilter>("all");
  const pagination = useTablePagination(20);
  const workflow = useInvoiceRequestWorkflow(patientId);

  const page = useInvoiceRequests({
    patientId,
    ...filterParams(filter),
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const stats = useInvoiceRequestStats(patientId);

  const handleFilter = (next: InvoiceRequestFilter) => {
    setFilter(next);
    pagination.resetToFirstPage();
  };

  const columns = buildInvoiceRequestColumns({
    now: Date.now(),
    onDetail: workflow.openDetail,
    onStart: workflow.start,
    onComplete: workflow.complete,
  });

  return (
    <div className="ir-panel">
      <InvoiceRequestHeader onCreate={workflow.openCreate} />
      <InvoiceRequestBanner stats={stats.data} onShowOpen={() => handleFilter("open")} />
      <InvoiceRequestChips value={filter} stats={stats.data} onChange={handleFilter} />
      <div className="bd-cat-card">
        <DataTable<InvoiceRequestDto>
          rowKey="id"
          loading={page.isLoading}
          columns={columns}
          dataSource={page.data?.items ?? []}
          scroll={{ x: 1314 }}
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
        {...(workflow.detail ? workflow.detailHandlers(workflow.detail) : { starting: false, copying: false })}
      />
      <InvoiceRequestFormDialog target={workflow.form} onClose={workflow.closeForm} />
      <InvoiceRequestActionDialog
        action={workflow.action}
        onClose={workflow.closeAction}
        onDone={workflow.handleActionDone}
      />
    </div>
  );
}
