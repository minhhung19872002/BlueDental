import { useState } from "react";
import { Button, Empty, Input, Select, Spin, Table, Tag } from "antd";
import { ExportOutlined, SearchOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import { toast } from "sonner";
import {
  invoiceStatusConfig,
  useInvoiceList,
  useIssueInvoice,
  useVoidInvoice,
  type InvoiceDto,
  type InvoiceStatus,
} from "../api";
import { InvoiceRowActions } from "../components/InvoiceRowActions";
import { PaymentModal } from "../components/PaymentModal";
import { VoidInvoiceDialog } from "../components/VoidInvoiceDialog";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PeriodPicker, periodRange, type Period } from "@/components/PeriodPicker";
import { PageHeader } from "@/components/PageHeader";
import { useAbility } from "@/hooks/useAbility";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { formatDate, formatVND } from "@/utils/format";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";
import "../components/billing.css";

/**
 * Thanh toán & hoá đơn.
 *
 * The three cards sum the page on screen, not the clinic: the invoice endpoint
 * returns a page and a count, never an aggregate. The "trên trang này" caption
 * was removed at the owner's request (2026-10-06).
 *
 * The list is read one Ngày / Tuần / Tháng window at a time, opening on today
 * (owner's request, 2026-10-06). There is no "no period" state to go back to.
 */
export function BillingPage() {
  const ability = useAbility("payment");
  const branchId = useCurrentBranchId();
  const pagination = useTablePagination(20);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | undefined>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [period, setPeriod] = useState<Period>(() => ({ mode: "day", anchor: new Date() }));
  const range = periodRange(period);
  const [paying, setPaying] = useState<InvoiceDto | null>(null);
  const [issuing, setIssuing] = useState<InvoiceDto | null>(null);
  const [voiding, setVoiding] = useState<InvoiceDto | null>(null);
  const issueInvoice = useIssueInvoice();
  const voidInvoice = useVoidInvoice();

  const handlePeriodChange = (next: Period) => {
    setPeriod(next);
    pagination.resetToFirstPage();
  };

  const handleIssue = () => {
    if (!issuing) return;
    issueInvoice.mutate(issuing.id, {
      onSuccess: () => {
        toast.success(t("Billing:IssuedToast", issuing.invoiceNumber));
        setIssuing(null);
      },
    });
  };

  const handleVoid = (reason: string) => {
    if (!voiding) return;
    voidInvoice.mutate(
      { id: voiding.id, reason },
      {
        onSuccess: () => {
          toast.success(t("Billing:VoidedToast", voiding.invoiceNumber));
          setVoiding(null);
        },
      },
    );
  };

  const listParams = {
    branchId,
    status: statusFilter,
    filter: debouncedSearch || undefined,
    fromDate: range?.from,
    toDate: range?.to,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  };

  const { data, isLoading } = useInvoiceList(listParams);
  const statusLook = invoiceStatusConfig();

  const rows = data?.items ?? [];
  const total = rows.reduce((sum, row) => sum + row.totalAmount, 0);
  const paid = rows.reduce((sum, row) => sum + row.paidAmount, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.balanceDue, 0);

  const handleExport = async () => {
    try {
      await downloadFile("/v1/app/invoices/excel", "hoa-don.xlsx", {
        branchId,
        status: statusFilter,
        filter: debouncedSearch || undefined,
        fromDate: range?.from,
        toDate: range?.to,
      });
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const columns: TableColumnsType<InvoiceDto> = [
    {
      title: t("Billing:InvoiceCode"),
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      width: 150,
      render: (value: string) => (
        <strong style={{ color: brand.blue }}>{value}</strong>
      ),
    },
    {
      title: t("Billing:Customer"),
      dataIndex: "patientName",
      key: "patientName",
      render: (value: string) => value || "—",
    },
    {
      title: t("Billing:Date"),
      dataIndex: "issuedAt",
      key: "issuedAt",
      width: 110,
      render: (value: string) => formatDate(value),
    },
    {
      title: t("Billing:TotalAmount"),
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 130,
      align: "right",
      render: (value: number) => <strong>{formatVND(value)}</strong>,
    },
    {
      title: t("Billing:Collected"),
      dataIndex: "paidAmount",
      key: "paidAmount",
      width: 130,
      align: "right",
      render: (value: number) => (
        <span style={{ color: brand.green, fontWeight: 600 }}>
          {formatVND(value)}
        </span>
      ),
    },
    {
      title: t("Billing:Remaining"),
      dataIndex: "balanceDue",
      key: "balanceDue",
      width: 130,
      align: "right",
      render: (value: number) => (
        <span style={{ color: value > 0 ? brand.red : brand.faint, fontWeight: 600 }}>
          {formatVND(value)}
        </span>
      ),
    },
    {
      title: t("Billing:StatusFilter"),
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (value: InvoiceStatus) => {
        const look = statusLook[value];
        return (
          <Tag
            style={{
              color: look.color,
              background: `${look.color}16`,
              border: "none",
              fontWeight: 600,
            }}
          >
            {look.label}
          </Tag>
        );
      },
    },
    {
      title: t("Common:Actions"),
      key: "actions",
      width: 200,
      fixed: "right",
      render: (_: unknown, row) => (
        <InvoiceRowActions
          invoice={row}
          canCollect={ability.canCreate}
          canUpdate={ability.canUpdate}
          onCollect={setPaying}
          onIssue={setIssuing}
          onVoid={setVoiding}
        />
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title={t("Billing:PageTitle")}
        subtitle={t("Billing:PageSubtitle")}
        actions={
          ability.canExport && (
            <Button icon={<ExportOutlined />} onClick={() => void handleExport()}>
              {t("Billing:ExportExcel")}
            </Button>
          )
        }
      />

      <div className="billing-kpis">
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Billing:KpiTotalInvoice")}</div>
          <div className="billing-kpi-value">{formatVND(total)}</div>
        </div>
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Billing:Collected")}</div>
          <div className="billing-kpi-value" style={{ color: brand.green }}>
            {formatVND(paid)}
          </div>
        </div>
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Billing:KpiDebt")}</div>
          <div className="billing-kpi-value" style={{ color: brand.red }}>
            {formatVND(outstanding)}
          </div>
        </div>
      </div>

      <div className="page-card billing-toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: brand.faint }} />}
          placeholder={t("Billing:SearchPlaceholder")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            pagination.resetToFirstPage();
          }}
          style={{ maxWidth: 280 }}
        />
        <Select
          allowClear
          placeholder={t("Billing:StatusFilter")}
          value={statusFilter}
          onChange={(value: InvoiceStatus | undefined) => {
            setStatusFilter(value);
            pagination.resetToFirstPage();
          }}
          style={{ minWidth: 190 }}
          options={Object.entries(statusLook).map(([value, look]) => ({
            value: Number(value) as InvoiceStatus,
            label: look.label,
          }))}
        />
        <PeriodPicker value={period} onChange={handlePeriodChange} />
      </div>

      <div className="page-card billing-table-card">
        {isLoading ? (
          <div className="billing-loading">
            <Spin />
          </div>
        ) : (
          <Table<InvoiceDto>
            size="small"
            rowKey="id"
            columns={columns}
            dataSource={rows}
            scroll={{ x: 1120 }}
            pagination={pagination.buildConfig(data?.totalCount)}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t("Billing:NoInvoice")}
                />
              ),
            }}
          />
        )}
      </div>

      <PaymentModal
        open={paying !== null}
        invoice={paying}
        onClose={() => setPaying(null)}
      />

      <ConfirmDialog
        open={issuing !== null}
        title={t("Billing:IssueTitle", issuing?.invoiceNumber ?? "")}
        message={t("Billing:IssueBody")}
        confirmLabel={t("Billing:Issue")}
        pending={issueInvoice.isPending}
        onConfirm={handleIssue}
        onClose={() => setIssuing(null)}
      />

      <VoidInvoiceDialog
        open={voiding !== null}
        invoiceNumber={voiding?.invoiceNumber ?? ""}
        pending={voidInvoice.isPending}
        onConfirm={handleVoid}
        onClose={() => setVoiding(null)}
      />
    </div>
  );
}
