import { Button, Descriptions, Space, Spin, Tag, Typography } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useInvoice } from "../api";

const { Title, Text } = Typography;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

interface Props {
  invoiceId: string;
}

export function InvoiceView({ invoiceId }: Props) {
  const { t } = useTranslation();
  const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
    draft:         { color: "default", label: t("billing.statusDraft") },
    issued:        { color: "blue",    label: t("billing.statusIssued") },
    partiallyPaid: { color: "orange",  label: t("billing.statusPartiallyPaid") },
    paid:          { color: "green",   label: t("billing.statusPaid") },
    overdue:       { color: "red",     label: t("billing.statusOverdue") },
    voided:        { color: "default", label: t("billing.statusVoided") },
  };
  const { data: invoice, isLoading, isError } = useInvoice(invoiceId);

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <Text type="danger">{t("billing.loadError")}</Text>
    );
  }

  const balance = invoice.totalAmount - invoice.paidAmount;
  const statusCfg = STATUS_CONFIG[invoice.status] ?? { color: "default", label: invoice.status };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 24 }}>
        <Space align="center">
          <Title level={4} style={{ margin: 0 }}>
            {t("billing.invoiceTitle", { number: invoice.invoiceNumber })}
          </Title>
          <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
        </Space>
        <Button
          icon={<PrinterOutlined />}
          onClick={() => window.print()}
        >
          {t("billing.printInvoice")}
        </Button>
      </Space>

      {/* Patient & dates */}
      <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t("billing.patientName")} span={2}>
          {invoice.patientName}
        </Descriptions.Item>
        <Descriptions.Item label={t("billing.issuedDate")}>
          {formatDate(invoice.issuedDate)}
        </Descriptions.Item>
        <Descriptions.Item label={t("billing.dueDate")}>
          {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
        </Descriptions.Item>
      </Descriptions>

      {/* Amounts */}
      <Descriptions bordered column={1}>
        <Descriptions.Item label={t("billing.totalAmount")}>
          <Text strong>{formatCurrency(invoice.totalAmount)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("billing.paidAmount")}>
          <Text type="success">{formatCurrency(invoice.paidAmount)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t("billing.balance")}>
          <Text type={balance > 0 ? "danger" : "secondary"} strong>
            {formatCurrency(balance)}
          </Text>
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}
