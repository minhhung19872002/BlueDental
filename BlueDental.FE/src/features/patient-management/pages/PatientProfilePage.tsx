import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button, Spin, Tabs, Tag, Row, Col, Card, Table, Typography, Space,
  type TableColumnsType,
} from "antd";
import {
  ArrowLeftOutlined, EditOutlined, CalendarOutlined,
  FileTextOutlined, PictureOutlined, MedicineBoxOutlined,
  PhoneOutlined, DollarOutlined, HistoryOutlined,
} from "@ant-design/icons";
import { usePatient } from "../api/patientQueries";
import { DentalChartView, type ToothRecord } from "../components/DentalChartView";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";

const { Text, Title } = Typography;

const GENDER_LABELS: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

interface AppointmentRow {
  id: string;
  date: string;
  doctorName: string;
  content: string;
  notes: string;
  status: string;
}

const APPOINTMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Scheduled:  { label: "Đã hẹn",    color: "#2671D8" },
  Confirmed:  { label: "Đã xác nhận", color: "#3B82F6" },
  CheckedIn:  { label: "Đã đến",    color: "#10B981" },
  InProgress: { label: "Đang khám", color: "#F97316" },
  Completed:  { label: "Hoàn thành", color: "#10B981" },
  Cancelled:  { label: "Đã hủy",    color: "#EF4444" },
  NoShow:     { label: "Vắng mặt",  color: "#6B7280" },
};

const APPOINTMENT_COUNTER_CARDS = [
  { key: "scheduled", label: "Đã hẹn",   borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
  { key: "arrived",   label: "Đã đến",   borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
  { key: "cancelled", label: "Đã huỷ",   borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
  { key: "late",      label: "Trễ hẹn",  borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
];

function TabPlaceholder({ label }: { label: string }) {
  return (
    <div style={{ padding: "48px 0", textAlign: "center", color: "#9CA3AF" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
      <Title level={5} style={{ color: "#6B7280" }}>{label}</Title>
      <Text type="secondary">Nội dung đang được phát triển</Text>
    </div>
  );
}

export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeeth, setSelectedTeeth] = useState<ToothRecord[]>([]);

  const activeTab = searchParams.get("tab") ?? "profile";
  const { data: patient, isLoading } = usePatient(id ?? "");

  const handleTabChange = (key: string) => {
    setSearchParams({ tab: key });
  };

  const handleToothClick = (fdi: number) => {
    setSelectedTeeth((prev) => {
      const exists = prev.find((t) => t.fdi === fdi);
      if (exists) return prev.filter((t) => t.fdi !== fdi);
      return [...prev, { fdi, status: "treated" }];
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!patient) return null;

  const appointmentColumns: TableColumnsType<AppointmentRow> = [
    {
      title: "Ngày / Giờ",
      dataIndex: "date",
      key: "date",
      width: 140,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{formatDateTime(v)}</Text>,
    },
    { title: "Bác sĩ phụ trách", dataIndex: "doctorName", key: "doctorName", width: 160 },
    { title: "Nội dung", dataIndex: "content", key: "content" },
    { title: "Ghi chú", dataIndex: "notes", key: "notes", width: 180 },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: string) => {
        const conf = APPOINTMENT_STATUS_CONFIG[status] ?? { label: status, color: "#6B7280" };
        return (
          <span
            style={{
              display: "inline-block",
              padding: "2px 10px",
              borderRadius: 10,
              backgroundColor: conf.color + "22",
              color: conf.color,
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {conf.label}
          </span>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 80,
      render: () => <Button type="text" size="small" icon={<EditOutlined />} />,
    },
  ];

  const TAB_ITEMS = [
    {
      key: "profile",
      label: "Hồ sơ",
      children: (
        <div style={{ padding: "16px 0" }}>
          <Row gutter={20}>
            {/* Left: patient info */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Thông tin bệnh nhân</span>
                    <Button type="text" size="small" icon={<EditOutlined />} />
                  </div>
                }
                size="small"
                style={{ marginBottom: 16 }}
              >
                <table style={{ width: "100%", borderSpacing: "0 8px", fontSize: 13 }}>
                  <tbody>
                    {[
                      { label: "Mã bệnh nhân", value: `[${patient.code}]` },
                      { label: "Họ và tên", value: patient.fullName },
                      { label: "Ngày sinh", value: formatDate(patient.dateOfBirth) },
                      { label: "Giới tính", value: GENDER_LABELS[patient.gender] },
                      { label: "Số điện thoại", value: patient.phone },
                      { label: "Email", value: patient.email ?? "—" },
                      { label: "Địa chỉ", value: patient.address ?? "—" },
                    ].map(({ label, value }) => (
                      <tr key={label}>
                        <td style={{ color: "#5A6B82", paddingRight: 16, paddingBottom: 4, whiteSpace: "nowrap", verticalAlign: "top" }}>
                          {label}
                        </td>
                        <td style={{ fontWeight: 500, color: "#1B2A41" }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#5A6B82", fontSize: 12, marginBottom: 6 }}>Nhãn / Tag</div>
                  <Space size={4} wrap>
                    <Tag color="blue">Chỉnh Nha</Tag>
                  </Space>
                </div>
              </Card>
            </Col>

            {/* Right: financial summary + treatment history */}
            <Col xs={24} lg={16}>
              {/* Financial summary */}
              <Row gutter={12} style={{ marginBottom: 16 }}>
                {[
                  { label: "Tổng chi phí", value: 0, color: "#1B2A41" },
                  { label: "Thực thu", value: 0, color: "#10B981" },
                  { label: "Công nợ", value: 0, color: "#EF4444" },
                ].map(({ label, value, color }) => (
                  <Col span={8} key={label}>
                    <Card size="small" style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color }}>
                        {formatVND(value)}
                        <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 2 }}>đ</span>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>

              {/* Treatment history stub */}
              <Card title="Lịch sử điều trị" size="small">
                <Table
                  size="small"
                  columns={[
                    { title: "Ngày", dataIndex: "date", width: 110, render: (v) => formatDate(v) },
                    { title: "Dịch vụ / Thủ thuật", dataIndex: "service" },
                    { title: "Bác sĩ", dataIndex: "doctor", width: 140 },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      width: 130,
                      render: (s: string) => <Tag color="success">{s}</Tag>,
                    },
                    {
                      title: "Số tiền",
                      dataIndex: "amount",
                      width: 120,
                      align: "right",
                      render: (v) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v)}</Text>,
                    },
                  ]}
                  dataSource={[]}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có lịch sử điều trị</span> }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "consulting",
      label: "Chẩn đoán & Tư vấn",
      children: (
        <div style={{ padding: "16px 0" }}>
          <Row gutter={20}>
            {/* Left: dental chart */}
            <Col xs={24} lg={12}>
              <Card
                title="Sơ đồ răng"
                size="small"
                extra={
                  <Space>
                    <Button size="small">Thêm ảnh</Button>
                    <Button size="small">Danh mục</Button>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Tabs
                  size="small"
                  defaultActiveKey="select"
                  items={[
                    { key: "select", label: "Chọn Răng" },
                    { key: "upper", label: "Hàm Trên" },
                    { key: "lower", label: "Hàm Dưới" },
                    { key: "full", label: "Nguyên Hàm" },
                  ]}
                />
                <DentalChartView
                  teeth={selectedTeeth}
                  onToothClick={handleToothClick}
                  style={{ marginTop: 8 }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                  Đã chọn:{" "}
                  {selectedTeeth.length > 0
                    ? selectedTeeth.map((t) => t.fdi).join(", ")
                    : "Chưa chọn răng"}
                </div>
              </Card>
            </Col>

            {/* Right: diagnosis records */}
            <Col xs={24} lg={12}>
              <Card title="Phiếu chẩn đoán" size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  columns={[
                    { title: "Số phiếu", dataIndex: "code", width: 80 },
                    { title: "Bác sĩ chẩn đoán 1", dataIndex: "doctor1", width: 160 },
                    { title: "Răng", dataIndex: "tooth" },
                    { title: "Ghi chú", dataIndex: "notes" },
                    { title: "Thao tác", key: "actions", width: 80, render: () => <Button type="link" size="small">Tạo Dịch Vụ</Button> },
                  ]}
                  dataSource={[]}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có phiếu chẩn đoán</span> }}
                />
              </Card>

              <Card title="Phiếu tư vấn" size="small">
                <Table
                  size="small"
                  columns={[
                    { title: "Ngày", dataIndex: "date", width: 100, render: (v) => formatDate(v) },
                    { title: "Dịch vụ", dataIndex: "service" },
                    { title: "Đơn giá", dataIndex: "unitPrice", width: 120, align: "right", render: (v) => `${formatVND(v)} đ` },
                    { title: "Thành tiền", dataIndex: "total", width: 120, align: "right", render: (v) => `${formatVND(v)} đ` },
                  ]}
                  dataSource={[]}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có phiếu tư vấn</span> }}
                />

                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginTop: 12,
                  padding: "10px 0", borderTop: "1px solid #E5E7EB",
                }}>
                  <Text strong style={{ fontSize: 13 }}>TỔNG KẾ HOẠCH</Text>
                  <Text style={{ fontSize: 13, color: "#5A6B82" }}>Tổng thành tiền: 0 đ</Text>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <Button size="small">Thêm kế hoạch điều trị</Button>
                    <Button size="small">Tạo báo giá</Button>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "treatment-plan",
      label: "Kế hoạch điều trị",
      icon: <FileTextOutlined />,
      children: <TabPlaceholder label="Kế hoạch điều trị" />,
    },
    {
      key: "appointment",
      label: "Lịch hẹn",
      icon: <CalendarOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Counter cards */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {APPOINTMENT_COUNTER_CARDS.map((card) => (
              <div
                key={card.key}
                style={{
                  minWidth: 70, minHeight: 55, padding: "8px 14px",
                  borderTop: `3px solid ${card.borderColor}`,
                  backgroundColor: card.bgColor,
                  borderRadius: 8, textAlign: "center",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 700, color: card.textColor }}>0</span>
                <span style={{ fontSize: 11, color: card.textColor }}>{card.label}</span>
              </div>
            ))}
          </div>

          <Table<AppointmentRow>
            size="small"
            rowKey="id"
            columns={appointmentColumns}
            dataSource={[]}
            pagination={false}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có lịch hẹn nào</span> }}
          />
        </div>
      ),
    },
    {
      key: "image",
      label: "Hình ảnh",
      icon: <PictureOutlined />,
      children: <TabPlaceholder label="Hình ảnh" />,
    },
    {
      key: "labo",
      label: "Labo",
      children: <TabPlaceholder label="Labo" />,
    },
    {
      key: "prescription",
      label: "Đơn thuốc",
      icon: <MedicineBoxOutlined />,
      children: <TabPlaceholder label="Đơn thuốc" />,
    },
    {
      key: "care",
      label: "Chăm sóc KH",
      icon: <PhoneOutlined />,
      children: <TabPlaceholder label="Chăm sóc KH" />,
    },
    {
      key: "invoice",
      label: "Hóa đơn",
      icon: <DollarOutlined />,
      children: (
        <div style={{ padding: "48px 0", textAlign: "center", color: "#9CA3AF" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <Text type="secondary">Nội dung đang được hoàn thiện</Text>
        </div>
      ),
    },
    {
      key: "debt-history",
      label: "Lịch sử dư nợ",
      icon: <HistoryOutlined />,
      children: <TabPlaceholder label="Lịch sử dư nợ" />,
    },
  ];

  return (
    <div className="page-container">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 14 }}>
        <Button
          type="text"
          size="small"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/patient")}
          style={{ color: "#2671D8", padding: "0 4px" }}
        >
          Quay lại
        </Button>
        <span style={{ color: "#D1D5DB" }}>/</span>
        <span style={{ color: "#1B2A41", fontWeight: 500 }}>
          [{patient.code}] - {patient.fullName}
        </span>
      </div>

      {/* 10 tabs with URL sync */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={TAB_ITEMS}
        style={{ background: "transparent" }}
      />
    </div>
  );
}
