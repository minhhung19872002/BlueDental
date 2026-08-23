import { Button, Descriptions, Space, Spin, Tag, Typography } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useInvoice } from "../api";

const { Title, Text } = Typography;

type InvoiceStatus = "draft" | "issued" | "partiallyPaid" | "paid" | "overdue" | "voided";

const STATUS_CONFIG: Record<
  string,
  { color: string; label: string }
> = {
  draft:         { color: "default", label: "Nháp" },
  issued:        { color: "blue",    label: "Đã phát hành" },
  partiallyPaid: { color: "orange",  label: "Thanh toán một phần" },
  paid:          { color: "green",   label: "Đã thanh toán" },
  overdue:       { color: "red",     label: "Quá hạn" },
  voided:        { color: "default", label: "Đã hủy" },
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

interface Props {
  invoiceId: string;
}

export function InvoiceView({ invoiceId }: Props) {
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
      <Text type="danger">Không thể tải thông tin hóa đơn.</Text>
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
            Hóa đơn {invoice.invoiceNumber}
          </Title>
          <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
        </Space>
        <Button
          icon={<PrinterOutlined />}
          onClick={() => window.print()}
        >
          In hóa đơn
        </Button>
      </Space>

      {/* Patient & dates */}
      <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label="Bệnh nhân" span={2}>
          {invoice.patientName}
        </Descriptions.Item>
        <Descriptions.Item label="Ngày phát hành">
          {formatDate(invoice.issuedDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Hạn thanh toán">
          {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
        </Descriptions.Item>
      </Descriptions>

      {/* Amounts */}
      <Descriptions bordered column={1}>
        <Descriptions.Item label="Tổng tiền">
          <Text strong>{formatCurrency(invoice.totalAmount)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Đã thanh toán">
          <Text type="success">{formatCurrency(invoice.paidAmount)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Còn lại">
          <Text type={balance > 0 ? "danger" : "secondary"} strong>
            {formatCurrency(balance)}
          </Text>
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}
