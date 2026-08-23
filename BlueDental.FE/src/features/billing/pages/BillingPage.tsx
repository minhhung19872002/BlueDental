import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Table, Tag, Tabs, Space, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useInvoiceList, type InvoiceDto } from "../api";
import { InvoiceView } from "../components/InvoiceView";
import { PaymentModal } from "../components/PaymentModal";
import { InsuranceClaimView } from "../components/InsuranceClaimView";

const { Text } = Typography;

const STATUS_COLOR: Record<string, string> = {
  draft:         "default",
  issued:        "blue",
  partiallyPaid: "orange",
  paid:          "green",
  overdue:       "red",
  voided:        "default",
};

const STATUS_LABEL_KEY: Record<string, string> = {
  draft:         "billing.statusDraft",
  issued:        "billing.statusIssued",
  partiallyPaid: "billing.statusPartiallyPaid",
  paid:          "billing.statusPaid",
  overdue:       "billing.statusOverdue",
  voided:        "billing.statusVoided",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

function InvoiceListPanel() {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { data, isLoading } = useInvoiceList({ maxResultCount: 50 });

  const columns: ColumnsType<InvoiceDto> = [
    {
      title: t("billing.invoiceNumber"),
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      render: (val: string, row: InvoiceDto) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => setSelectedId(row.id)}>
          {val}
        </Button>
      ),
    },
    {
      title: t("billing.patientName"),
      dataIndex: "patientName",
      key: "patientName",
    },
    {
      title: t("billing.issuedDate"),
      dataIndex: "issuedDate",
      key: "issuedDate",
      render: (v: string) => formatDate(v),
    },
    {
      title: t("billing.totalAmount"),
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (v: number) => <Text strong>{formatCurrency(v)}</Text>,
    },
    {
      title: t("billing.paidAmount"),
      dataIndex: "paidAmount",
      key: "paidAmount",
      render: (v: number) => <Text type="success">{formatCurrency(v)}</Text>,
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? "default"}>{STATUS_LABEL_KEY[v] ? t(STATUS_LABEL_KEY[v]) : v}</Tag>
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, row: InvoiceDto) => (
        <Space>
          <Button size="small" onClick={() => setSelectedId(row.id)}>
            {t("billing.view")}
          </Button>
          {row.status !== "paid" && row.status !== "voided" && (
            <Button
              size="small"
              type="primary"
              onClick={() => {
                setSelectedId(row.id);
                setPaymentOpen(true);
              }}
            >
              {t("billing.pay")}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  if (selectedId && !paymentOpen) {
    return (
      <div>
        <Button style={{ marginBottom: 16 }} onClick={() => setSelectedId(null)}>
          {t("billing.backToList")}
        </Button>
        <InvoiceView invoiceId={selectedId} />
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Button
            type="primary"
            onClick={() => setPaymentOpen(true)}
          >
            {t("billing.recordPayment")}
          </Button>
        </div>
        <PaymentModal
          open={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          invoiceId={selectedId}
        />
      </div>
    );
  }

  return (
    <div>
      <Table<InvoiceDto>
        rowKey="id"
        columns={columns}
        dataSource={data?.items ?? []}
        loading={isLoading}
        pagination={{ pageSize: 10 }}
        size="middle"
        locale={{ emptyText: t("billing.noInvoices") }}
      />
      {selectedId && (
        <PaymentModal
          open={paymentOpen}
          onClose={() => {
            setPaymentOpen(false);
            setSelectedId(null);
          }}
          invoiceId={selectedId}
        />
      )}
    </div>
  );
}

export function BillingPage() {
  const { t } = useTranslation();
  const tabItems = [
    {
      key: "invoices",
      label: t("billing.invoices"),
      children: (
        <div style={{ paddingTop: 16 }}>
          <InvoiceListPanel />
        </div>
      ),
    },
    {
      key: "insurance",
      label: t("billing.insurance"),
      children: (
        <div style={{ paddingTop: 16 }}>
          <InsuranceClaimView patientId="" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          border: "1px solid #E5E7EB",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1B2A41" }}>
          {t("billing.title")}
        </h2>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #E5E7EB",
          padding: "0 20px",
        }}
      >
        <Tabs items={tabItems} />
      </div>
    </div>
  );
}
