import { useState } from "react";
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

const STATUS_LABEL: Record<string, string> = {
  draft:         "Nháp",
  issued:        "Đã phát hành",
  partiallyPaid: "Thanh toán một phần",
  paid:          "Đã thanh toán",
  overdue:       "Quá hạn",
  voided:        "Đã hủy",
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const { data, isLoading } = useInvoiceList({ maxResultCount: 50 });

  const columns: ColumnsType<InvoiceDto> = [
    {
      title: "Số hóa đơn",
      dataIndex: "invoiceNumber",
      key: "invoiceNumber",
      render: (val: string, row: InvoiceDto) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => setSelectedId(row.id)}>
          {val}
        </Button>
      ),
    },
    {
      title: "Bệnh nhân",
      dataIndex: "patientName",
      key: "patientName",
    },
    {
      title: "Ngày phát hành",
      dataIndex: "issuedDate",
      key: "issuedDate",
      render: (v: string) => formatDate(v),
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      key: "totalAmount",
      render: (v: number) => <Text strong>{formatCurrency(v)}</Text>,
    },
    {
      title: "Đã thanh toán",
      dataIndex: "paidAmount",
      key: "paidAmount",
      render: (v: number) => <Text type="success">{formatCurrency(v)}</Text>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? "default"}>{STATUS_LABEL[v] ?? v}</Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      render: (_: unknown, row: InvoiceDto) => (
        <Space>
          <Button size="small" onClick={() => setSelectedId(row.id)}>
            Xem
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
              Thanh toán
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
          ← Quay lại danh sách
        </Button>
        <InvoiceView invoiceId={selectedId} />
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Button
            type="primary"
            onClick={() => setPaymentOpen(true)}
          >
            Ghi nhận thanh toán
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
        locale={{ emptyText: "Chưa có hóa đơn nào" }}
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
  const tabItems = [
    {
      key: "invoices",
      label: "Hóa đơn",
      children: (
        <div style={{ paddingTop: 16 }}>
          <InvoiceListPanel />
        </div>
      ),
    },
    {
      key: "insurance",
      label: "Bảo hiểm",
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
          Thanh toán & Hóa đơn
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
