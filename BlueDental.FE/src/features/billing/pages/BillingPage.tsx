import { useMemo, useState, type ReactNode } from "react";
import { Button, Empty, Input, Spin, Table } from "antd";
import { ExportOutlined, SearchOutlined } from "@ant-design/icons";
import { PeriodPicker, periodRange, type Period } from "@/components/PeriodPicker";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
import {
  PAYMENT_LEDGER_EXCEL_URL,
  usePaymentLedger,
  type PaymentLedgerItemDto,
} from "../api/paymentLedgerApi";
import { PaymentLedgerKpis } from "../components/PaymentLedgerKpis";
import { buildPaymentLedgerColumns } from "../components/paymentLedgerColumns";
import "../components/billing.css";

/**
 * The receipt sheet and the e-invoice dialog belong to treatment-management,
 * which billing may not import; the app's route hands them in.
 */
export interface LedgerRowDialogs {
  /** "Chi tiết phiếu" with its print button. */
  renderReceipt: (row: PaymentLedgerItemDto, onClose: () => void) => ReactNode;
  /** "Xuất hoá đơn điện tử" for this one receipt. */
  renderEInvoice: (row: PaymentLedgerItemDto, onClose: () => void) => ReactNode;
}

/**
 * Tài chính → Thanh toán (BA, 2026-10-06): every "Tạo Phiếu Thanh Toán"
 * receipt written on a treatment plan, newest first. A row can be viewed,
 * printed and e-invoiced here; it is edited or deleted on its plan, which the
 * row links to.
 *
 * Only Thanh toán receipts are listed; Tạm ứng and Hoàn tiền stay on the plan.
 * The list is read one Ngày / Tuần / Tháng window at a time, opening on today.
 */
export function BillingPage({ dialogs }: { dialogs: LedgerRowDialogs }) {
  const ability = useAbility("payment");
  const canFinalize = ability.can("finalize");
  // The receipt sheet reads the patient and the plan's slip.
  const canReadPatient = useAbility("patient").canRead;
  const canReadSlip = useAbility("treatmentConsultation").canRead;
  const canViewReceipt = canReadPatient && canReadSlip;
  const branchId = useCurrentBranchId();
  const pagination = useTablePagination(20);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [period, setPeriod] = useState<Period>(() => ({ mode: "day", anchor: new Date() }));
  const range = periodRange(period);

  const filters = {
    filter: debouncedSearch.trim() || undefined,
    fromDate: range?.from,
    toDate: range?.to,
  };
  const { data, isLoading } = usePaymentLedger(branchId, {
    ...filters,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const [viewing, setViewing] = useState<PaymentLedgerItemDto | null>(null);
  const [invoicing, setInvoicing] = useState<PaymentLedgerItemDto | null>(null);
  const columns = useMemo(
    () =>
      buildPaymentLedgerColumns(branchId, {
        onView: canViewReceipt ? setViewing : undefined,
        onIssueEInvoice: canFinalize ? setInvoicing : undefined,
      }),
    [branchId, canViewReceipt, canFinalize],
  );

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    pagination.resetToFirstPage();
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    pagination.resetToFirstPage();
  };

  const handleExport = async () => {
    try {
      await downloadFile(PAYMENT_LEDGER_EXCEL_URL, "thanh-toan.xlsx", filters);
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t("Billing:Ledger:Title")}
        subtitle={t("Billing:Ledger:Subtitle")}
        actions={
          ability.canExport && (
            <Button icon={<ExportOutlined />} onClick={() => void handleExport()}>
              {t("Billing:ExportExcel")}
            </Button>
          )
        }
      />

      <PaymentLedgerKpis totalAmount={data?.totalAmount ?? 0} totalCount={data?.totalCount ?? 0} />

      <div className="page-card billing-toolbar">
        <Input
          allowClear
          className="billing-search"
          prefix={<SearchOutlined className="billing-search-icon" />}
          placeholder={t("Billing:Ledger:Search")}
          value={search}
          onChange={handleSearchChange}
        />
        <PeriodPicker value={period} onChange={handlePeriodChange} />
      </div>

      <div className="page-card billing-table-card">
        {isLoading ? (
          <div className="billing-loading">
            <Spin />
          </div>
        ) : (
          <Table<PaymentLedgerItemDto>
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={data?.items ?? []}
            scroll={{ x: 1560 }}
            pagination={pagination.buildConfig(data?.totalCount)}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Billing:Ledger:Empty")} />
              ),
            }}
          />
        )}
      </div>

      {viewing && dialogs.renderReceipt(viewing, () => setViewing(null))}
      {invoicing && dialogs.renderEInvoice(invoicing, () => setInvoicing(null))}
    </div>
  );
}
