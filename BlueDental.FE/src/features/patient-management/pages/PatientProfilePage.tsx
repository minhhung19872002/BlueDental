import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button, Spin, Tabs, Tag, Row, Col, Card, Table, Typography, Space, Select,
  type TableColumnsType,
} from "antd";
import {
  ArrowLeftOutlined, EditOutlined, CalendarOutlined,
  FileTextOutlined, PictureOutlined, MedicineBoxOutlined,
  PhoneOutlined, DollarOutlined, HistoryOutlined, PlusOutlined, UploadOutlined,
} from "@ant-design/icons";
import { usePatient } from "../api/patientQueries";
import { DentalChartView, type ToothRecord } from "../components/DentalChartView";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import { useTreatmentPlanList, usePatientPrescriptions } from "@/features/treatment-management/api/index";
import { usePatientInvoices } from "@/features/billing/api/index";
import { usePatientLaboOrders } from "@/features/labo/api/laboApi";
import { useCareRecordList } from "@/features/cskh/api/careApi";
import { usePatientDiagnosticRecords } from "@/features/treatment-management/api/diagnosticApi";
import { usePatientConsultationRecords } from "@/features/treatment-management/api/consultationApi";

const { Text } = Typography;

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


export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeeth, setSelectedTeeth] = useState<ToothRecord[]>([]);

  const activeTab = searchParams.get("tab") ?? "profile";
  const { data: patient, isLoading } = usePatient(id ?? "");

  const { data: appointmentsData } = useAppointmentList({ patientId: id, maxResultCount: 50 });
  const { data: treatmentPlans } = useTreatmentPlanList({ patientId: id });
  const { data: invoices } = usePatientInvoices(id ?? "");
  const { data: laboOrders } = usePatientLaboOrders(id ?? "");
  const { data: careRecords } = useCareRecordList({ patientId: id, maxResultCount: 50 });
  const { data: prescriptions } = usePatientPrescriptions(id ?? "");
  const { data: diagnosticRecords } = usePatientDiagnosticRecords(id ?? "");
  const { data: consultationRecords } = usePatientConsultationRecords(id ?? "");
  const appointments = appointmentsData?.items ?? [];
  const plans = treatmentPlans?.items ?? [];
  const patientInvoices = invoices ?? [];
  const patientLaboOrders = laboOrders ?? [];
  const patientCareRecords = careRecords?.items ?? [];
  const patientPrescriptions = prescriptions ?? [];
  const patientDiagnostics = diagnosticRecords ?? [];
  const patientConsultations = consultationRecords ?? [];

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
              {(() => {
                const totalCost = patientInvoices.reduce((s, inv) => s + (inv.totalAmount ?? 0), 0);
                const totalPaid = patientInvoices.reduce((s, inv) => s + (inv.paidAmount ?? 0), 0);
                const totalDebt = Math.max(0, totalCost - totalPaid);
                return (
                  <Row gutter={12} style={{ marginBottom: 16 }}>
                    {[
                      { label: "Tổng chi phí", value: totalCost,  color: "#1B2A41" },
                      { label: "Thực thu",      value: totalPaid,  color: "#10B981" },
                      { label: "Công nợ",       value: totalDebt,  color: "#EF4444" },
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
                );
              })()}

              {/* Treatment history — uses completed appointments as proxy */}
              <Card title="Lịch sử điều trị" size="small">
                <Table
                  size="small"
                  columns={[
                    { title: "Ngày", dataIndex: "date", width: 110, render: (v: string) => formatDate(v) },
                    { title: "Dịch vụ / Thủ thuật", dataIndex: "service" },
                    { title: "Bác sĩ", dataIndex: "doctor", width: 140 },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      width: 130,
                      render: () => <Tag color="success">Hoàn thành</Tag>,
                    },
                  ]}
                  dataSource={appointments
                    .filter((a) => a.status === "completed")
                    .map((a) => ({
                      key: a.id,
                      date: a.startTime,
                      service: a.reason ?? "Khám tổng quát",
                      doctor: a.doctorName,
                      status: a.status,
                    }))}
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
                  rowKey="id"
                  columns={[
                    { title: "Số phiếu", dataIndex: "code", width: 120 },
                    { title: "Bác sĩ chẩn đoán", dataIndex: "dentistName", width: 160 },
                    { title: "Răng", dataIndex: "teethNumbers" },
                    { title: "Ghi chú", dataIndex: "notes" },
                    { title: "Thao tác", key: "actions", width: 80, render: () => <Button type="link" size="small">Tạo Dịch Vụ</Button> },
                  ]}
                  dataSource={patientDiagnostics}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có phiếu chẩn đoán</span> }}
                />
              </Card>

              <Card title="Phiếu tư vấn" size="small">
                <Table
                  size="small"
                  rowKey="id"
                  columns={[
                    { title: "Ngày", dataIndex: "creationTime", width: 100, render: (v: string) => formatDate(v) },
                    { title: "Dịch vụ", dataIndex: "serviceName" },
                    { title: "Đơn giá", dataIndex: "unitPrice", width: 120, align: "right" as const, render: (v: number) => `${formatVND(v ?? 0)} đ` },
                    { title: "Thành tiền", dataIndex: "totalAmount", width: 120, align: "right" as const, render: (v: number) => `${formatVND(v ?? 0)} đ` },
                  ]}
                  dataSource={patientConsultations}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có phiếu tư vấn</span> }}
                />

                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginTop: 12,
                  padding: "10px 0", borderTop: "1px solid #E5E7EB",
                }}>
                  <Text strong style={{ fontSize: 13 }}>TỔNG KẾ HOẠCH</Text>
                  <Text style={{ fontSize: 13, color: "#5A6B82" }}>Tổng thành tiền: {formatVND(patientConsultations.reduce((s, c) => s + (c.totalAmount ?? 0), 0))} đ</Text>
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
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
            <Button icon={<PlusOutlined />}>Tạo kế hoạch mới</Button>
            <Button>Xem tất cả dịch vụ</Button>
          </div>

          {/* Summary cards */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card size="small" style={{ borderLeft: "4px solid #2671D8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#2671D8", color: "#fff", borderRadius: 12, padding: "2px 10px", fontWeight: 700, fontSize: 14 }}>0</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41" }}>Dịch vụ đang điều trị</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>Chưa có dịch vụ đang điều trị</div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" style={{ borderLeft: "4px solid #10B981" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 4 }}>Dịch vụ có công đoạn gần nhất</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>Chưa có công đoạn</div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* Treatment plan table */}
          <Card size="small">
            <Table
              size="small"
              rowKey="id"
              columns={[
                { title: "Thêm công đoạn", key: "addStep", width: 120, render: () => <Button size="small" type="link">+ Công đoạn</Button> },
                { title: "Số phiếu", dataIndex: "code", key: "code", width: 80, render: (v: string) => <Button type="link" size="small">{v}</Button> },
                { title: "Dịch vụ", dataIndex: "serviceName", key: "serviceName", width: 200 },
                { title: "Bác sĩ tiếp nhận", dataIndex: "doctorName", key: "doctorName", width: 140 },
                { title: "Trạng thái", dataIndex: "status", key: "status", width: 140, render: (v: string) => v ? <Tag color="processing">{v}</Tag> : null },
                { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt", width: 110, render: (v: string) => v ? formatDate(v) : "—" },
                { title: "Tổng phiếu", dataIndex: "totalAmount", key: "totalAmount", width: 120, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: "Giảm giá", dataIndex: "discountAmount", key: "discountAmount", width: 110, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: "Thành tiền", dataIndex: "finalAmount", key: "finalAmount", width: 120, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: "Đã trả", dataIndex: "paidAmount", key: "paidAmount", width: 110, align: "right", render: (v: number) => <Text style={{ color: "#10B981" }}>{formatVND(v ?? 0)} đ</Text> },
                { title: "Hoàn tiền", dataIndex: "refundedAmount", key: "refundedAmount", width: 100, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: "Còn lại", dataIndex: "remainingAmount", key: "remainingAmount", width: 120, align: "right", render: (v: number) => <Text style={{ color: "#EF4444" }}>{formatVND(v ?? 0)} đ</Text> },
                { title: "Phải thu", dataIndex: "toCollect", key: "toCollect", width: 110, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: "Thao tác", key: "actions", width: 80, fixed: "right", render: () => <Space size={4}><Button type="text" size="small" icon={<EditOutlined />} /></Space> },
              ]}
              dataSource={plans.map((p) => ({
                id: p.id,
                code: p.id.slice(0, 8).toUpperCase(),
                serviceName: p.title,
                doctorName: "—",
                status: p.status,
                createdAt: p.creationTime,
                totalAmount: p.estimatedCost ?? 0,
                discountAmount: 0,
                finalAmount: p.estimatedCost ?? 0,
                paidAmount: 0,
                refundedAmount: 0,
                remainingAmount: p.estimatedCost ?? 0,
                toCollect: p.estimatedCost ?? 0,
              }))}
              pagination={{ pageSize: 20, showTotal: (total, range) => `${range[0]}–${range[1]} / ${total} kế hoạch` }}
              scroll={{ x: 1400 }}
              locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có kế hoạch điều trị</span> }}
            />
          </Card>
        </div>
      ),
    },
    {
      key: "appointment",
      label: "Lịch hẹn",
      icon: <CalendarOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Counter cards */}
          {(() => {
            const counts: Record<string, number> = {
              scheduled: appointments.filter((a) => a.status === "scheduled" || a.status === "confirmed").length,
              arrived: appointments.filter((a) => a.status === "inProgress" || a.status === "completed").length,
              cancelled: appointments.filter((a) => a.status === "cancelled").length,
              late: appointments.filter((a) => a.status === "noShow").length,
            };
            return (
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
                    <span style={{ fontSize: 20, fontWeight: 700, color: card.textColor }}>{counts[card.key] ?? 0}</span>
                    <span style={{ fontSize: 11, color: card.textColor }}>{card.label}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          <Table<AppointmentRow>
            size="small"
            rowKey="id"
            columns={appointmentColumns}
            dataSource={appointments.map((a) => ({
              id: a.id,
              date: a.startTime,
              doctorName: a.doctorName,
              content: a.reason ?? "Khám tổng quát",
              notes: a.notes ?? "—",
              status: a.status,
            }))}
            pagination={{ pageSize: 20, showTotal: (t, r) => `${r[0]}–${r[1]} / ${t}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có lịch hẹn nào</span> }}
          />
        </div>
      ),
    },
    {
      key: "image",
      label: "Hình ảnh",
      icon: <PictureOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <Select placeholder="Giai đoạn điều trị" style={{ width: 220 }} allowClear options={[]} />
            <Button icon={<UploadOutlined />} style={{ marginLeft: "auto" }}>Tải ảnh</Button>
          </div>
          <div style={{ padding: "60px 0", textAlign: "center", color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
            <PictureOutlined style={{ fontSize: 40, marginBottom: 12, color: "#D1D5DB" }} />
            <div style={{ fontWeight: 500, color: "#6B7280", marginBottom: 4 }}>Không có ảnh trong bộ lọc đã chọn</div>
            <div style={{ fontSize: 13 }}>Hãy đổi bộ lọc hoặc tải thêm ảnh để tiếp tục.</div>
          </div>
        </div>
      ),
    },
    {
      key: "labo",
      label: "Labo",
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Top bar: counter filter buttons + create button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Đơn hàng mới", count: 0, bg: "#E6F4EA", text: "#10B981", border: "#10B981" },
              { label: "Tiếp tục công đoạn", count: 0, bg: "#FEF3C7", text: "#D97706", border: "#F59E0B" },
              { label: "Bảo hành", count: 0, bg: "#FCE8E6", text: "#DC2626", border: "#EF4444" },
            ].map((c) => (
              <button
                key={c.label}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                  background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                  borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15 }}>{c.count}</span>
                {c.label}
              </button>
            ))}
            <Button type="primary" icon={<PlusOutlined />} style={{ marginLeft: "auto", background: "#2671D8" }}>
              Tạo phiếu Labo
            </Button>
          </div>

          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: "Mã phiếu labo", dataIndex: "code", key: "code", width: 120 },
              { title: "Ngày gửi / Tình trạng mẫu", dataIndex: "sentAt", key: "sentAt", width: 160, render: (v: string) => v ? formatDate(v) : "—" },
              { title: "Ngày giao / Trạng thái Labo", dataIndex: "deliveredAt", key: "deliveredAt", width: 170, render: (v: string) => v ? formatDate(v) : "—" },
              { title: "Bác sĩ chỉ định", dataIndex: "doctorName", key: "doctorName", width: 140 },
              { title: "Nhà cung cấp", dataIndex: "supplierName", key: "supplierName", width: 140 },
              { title: "Vật liệu", dataIndex: "material", key: "material", width: 120 },
              { title: "Số răng", dataIndex: "toothNumbers", key: "toothNumbers", width: 100 },
              { title: "Số lượng", dataIndex: "quantity", key: "quantity", width: 80, align: "right" },
              { title: "File Labo gửi về", dataIndex: "returnedFile", key: "returnedFile", width: 130 },
              { title: "Thao tác", key: "actions", width: 80, render: () => <Button type="text" size="small" icon={<EditOutlined />} /> },
            ]}
            dataSource={patientLaboOrders.map((o) => ({
              ...o,
              code: o.orderCode,
              sentAt: o.sentAt,
              deliveredAt: o.receivedAt,
              doctorName: "—",
              supplierName: o.labProviderName,
              material: o.workDescription ?? "—",
              toothNumbers: o.toothNumbers ?? "—",
              quantity: 1,
              returnedFile: "—",
            }))}
            pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total} phiếu labo` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Không có dữ liệu</span> }}
          />
        </div>
      ),
    },
    {
      key: "prescription",
      label: "Đơn thuốc",
      icon: <MedicineBoxOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} style={{ background: "#2671D8" }}>Tạo đơn thuốc</Button>
          </div>
          <Table
            size="small"
            columns={[
              { title: "Thuốc", dataIndex: "medicationName", key: "medicationName", render: (v: string) => v || "—" },
              { title: "Liều dùng", dataIndex: "dosage", key: "dosage", width: 120 },
              { title: "Tần suất", dataIndex: "frequency", key: "frequency", width: 120 },
              { title: "Số ngày", dataIndex: "durationDays", key: "durationDays", width: 80, align: "right" as const },
              { title: "Hướng dẫn", dataIndex: "instructions", key: "instructions", render: (v: string) => v || "—" },
              { title: "Trạng thái", dataIndex: "status", key: "status", width: 120 },
              { title: "Ngày kê", dataIndex: "issuedAt", key: "issuedAt", width: 120, render: (v: string) => v ? formatDate(v) : "—" },
              { title: "Thao tác", key: "actions", width: 80, render: () => <Button type="text" size="small" icon={<EditOutlined />} /> },
            ]}
            dataSource={patientPrescriptions}
            rowKey="id"
            pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0 trên ${total}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Không có đơn thuốc</span> }}
          />
        </div>
      ),
    },
    {
      key: "care",
      label: "Chăm sóc KH",
      icon: <PhoneOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Status filter buttons + action button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: "Đã chăm sóc", count: 0 },
              { label: "Tốt", count: 0 },
              { label: "Khá", count: 0 },
              { label: "Bình thường", count: 0 },
              { label: "Khiếu nại", count: 0 },
              { label: "Đặc biệt", count: 0 },
              { label: "Định kỳ", count: 0 },
              { label: "Cơ bản", count: 0 },
            ].map((b) => (
              <button
                key={b.label}
                style={{
                  padding: "4px 12px", borderRadius: 16, border: "1px solid #E5E7EB",
                  background: "#F9FAFB", color: "#374151", fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontWeight: 600 }}>{b.count}</span>
                {b.label}
              </button>
            ))}
            <Button style={{ marginLeft: "auto" }}>CSKH đặc biệt</Button>
          </div>

          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: "Ngày chăm sóc", dataIndex: "careDate", key: "careDate", width: 130, render: (v: string) => v ? formatDate(v) : "—" },
              { title: "Trạng thái CSKH", dataIndex: "careStatus", key: "careStatus", width: 140 },
              { title: "Nhóm", dataIndex: "group", key: "group", width: 160 },
              { title: "Dịch vụ", dataIndex: "serviceName", key: "serviceName", width: 180 },
              { title: "Nội dung", dataIndex: "content", key: "content" },
              { title: "Bác sĩ điều trị", dataIndex: "doctorName", key: "doctorName", width: 140 },
              { title: "Nhân viên chăm sóc", dataIndex: "staffName", key: "staffName", width: 150 },
              { title: "Đánh giá", dataIndex: "rating", key: "rating", width: 100 },
              { title: "Thao tác", key: "actions", width: 100, render: () => <Space size={4}><Button type="text" size="small" icon={<EditOutlined />} /></Space> },
            ]}
            dataSource={patientCareRecords.map((r) => ({
              id: r.id,
              careDate: r.dueAt ?? r.creationTime,
              careStatus: r.status,
              group: r.type,
              serviceName: r.subject,
              content: r.description ?? "—",
              doctorName: "—",
              staffName: "—",
              rating: r.resolution ?? "—",
            }))}
            pagination={{ pageSize: 20, showTotal: (total) => `Hiển thị 0–0 trên ${total} nhật ký` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có dữ liệu chăm sóc</span> }}
          />
        </div>
      ),
    },
    {
      key: "invoice",
      label: "Hóa đơn",
      icon: <DollarOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: "Số hóa đơn", dataIndex: "invoiceNumber", key: "invoiceNumber", width: 140 },
              { title: "Ngày tạo", dataIndex: "issuedDate", key: "issuedDate", width: 120, render: (v: string) => v ? formatDate(v) : "—" },
              { title: "Tổng tiền", dataIndex: "totalAmount", key: "totalAmount", width: 140, align: "right" as const,
                render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: "Đã thanh toán", dataIndex: "paidAmount", key: "paidAmount", width: 140, align: "right" as const,
                render: (v: number) => <Text style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: "Trạng thái", dataIndex: "status", key: "status", width: 120,
                render: (s: string) => <Tag color={s === "Paid" ? "success" : s === "Draft" ? "default" : "warning"}>{s}</Tag> },
            ]}
            dataSource={patientInvoices}
            pagination={{ pageSize: 20, showTotal: (t, r) => `${r[0]}–${r[1]} / ${t} hóa đơn` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có hóa đơn</span> }}
          />
        </div>
      ),
    },
    {
      key: "debt-history",
      label: "Lịch sử dư nợ",
      icon: <HistoryOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: "Ngày giao dịch", dataIndex: "transactionDate", key: "transactionDate", width: 160, render: (v: string) => v ? formatDateTime(v) : "—" },
              { title: "Loại", dataIndex: "type", key: "type", width: 140 },
              { title: "Số tiền", dataIndex: "amount", key: "amount", width: 140, align: "right", render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: "Nhân viên", dataIndex: "staffName", key: "staffName", width: 160 },
              { title: "Ghi chú", dataIndex: "notes", key: "notes" },
            ]}
            dataSource={(patientInvoices ?? []).map((inv) => ({
              id: inv.id,
              transactionDate: inv.issuedDate,
              type: inv.status === "Paid" ? "Thanh toán" : inv.status === "Voided" ? "Huỷ" : "Hóa đơn",
              amount: inv.totalAmount - inv.paidAmount,
              staffName: "—",
              notes: `${inv.invoiceNumber} — ${inv.status}`,
            })).filter((r) => r.amount > 0)}
            pagination={{ pageSize: 20, showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} giao dịch` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có lịch sử dư nợ</span> }}
          />
        </div>
      ),
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
