import { useState } from "react";
import { Button, Empty, Input, Select, Spin, Table, Tag, message } from "antd";
import { ExportOutlined, SearchOutlined } from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import {
  INVOICE_STATUS,
  invoiceStatusConfig,
  useInvoiceList,
  type InvoiceDto,
  type InvoiceStatus,
} from "../api";
import { PaymentModal } from "../components/PaymentModal";
import { PageHeader } from "@/components/PageHeader";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";
import { extractApiError } from "@/lib/apiError";
import { formatDate, formatVND } from "@/utils/format";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

/** An invoice that is still owed money and may still be collected against. */
function isCollectable(row: InvoiceDto): boolean {
  return (
    row.balanceDue > 0 &&
    row.status !== INVOICE_STATUS.Voided &&
    row.status !== INVOICE_STATUS.Draft &&
    row.status !== INVOICE_STATUS.Refunded
  );
}

/**
 * Thanh toán & hoá đơn.
 *
 * The three cards sum the page on screen, not the clinic: the invoice endpoint
 * returns a page and a count, never an aggregate, so the labels say "trên trang
 * này" rather than implying a figure the server never sent.
 */
export function BillingPage() {
  const branchId = useCurrentBranchId();
  const pagination = useTablePagination(20);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | undefined>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [paying, setPaying] = useState<InvoiceDto | null>(null);

  const listParams = {
    branchId,
    status: statusFilter,
    filter: debouncedSearch || undefined,
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
      });
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const columns: TableColumnsType<InvoiceDto> = [
    {
      title: t("Mã phiếu"),
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      width: 150,
      render: (value: string) => (
        <strong style={{ color: brand.blue }}>{value}</strong>
      ),
    },
    {
      title: t("Khách hàng"),
      dataIndex: "patientName",
      key: "patientName",
      render: (value: string) => value || "—",
    },
    {
      title: t("Ngày"),
      dataIndex: "issuedAt",
      key: "issuedAt",
      width: 110,
      render: (value: string) => formatDate(value),
    },
    {
      title: t("Tổng tiền"),
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 130,
      align: "right",
      render: (value: number) => <strong>{formatVND(value)}</strong>,
    },
    {
      title: t("Đã thu"),
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
      title: t("Còn lại"),
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
      title: t("Trạng thái"),
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
      title: t("Thao tác"),
      key: "actions",
      width: 158,
      fixed: "right",
      render: (_: unknown, row) => (
        <Button
          size="small"
          type="primary"
          disabled={!isCollectable(row)}
          onClick={() => setPaying(row)}
        >
          {t("Thu tiền")}
        </Button>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title={t("Thanh toán & hoá đơn")}
        subtitle={t("Bấm “Thu tiền” để ghi nhận thanh toán từng phiếu")}
        actions={
          <Button icon={<ExportOutlined />} onClick={() => void handleExport()}>
            {t("Xuất Excel")}
          </Button>
        }
      />

      <div className="billing-kpis">
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Tổng giá trị hoá đơn")}</div>
          <div className="billing-kpi-value">{formatVND(total)}</div>
          <div className="billing-kpi-caption">{t("trên trang này")}</div>
        </div>
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Đã thu")}</div>
          <div className="billing-kpi-value" style={{ color: brand.green }}>
            {formatVND(paid)}
          </div>
          <div className="billing-kpi-caption">{t("trên trang này")}</div>
        </div>
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Công nợ còn lại")}</div>
          <div className="billing-kpi-value" style={{ color: brand.red }}>
            {formatVND(outstanding)}
          </div>
          <div className="billing-kpi-caption">{t("trên trang này")}</div>
        </div>
      </div>

      <div className="page-card billing-toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: brand.faint }} />}
          placeholder={t("Tìm theo mã phiếu...")}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            pagination.resetToFirstPage();
          }}
          style={{ maxWidth: 280 }}
        />
        <Select
          allowClear
          placeholder={t("Trạng thái")}
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
                  description={t("Chưa có hoá đơn")}
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
    </div>
  );
}
