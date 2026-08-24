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
import { INVOICE_STATUS, usePatientInvoices } from "@/features/billing/api/index";
import { usePatientLaboOrders } from "@/features/labo/api/laboApi";
import { useCareRecordList } from "@/features/cskh/api/careApi";
import {
  usePatientAdviseSummary,
  usePatientAdvises,
  usePatientDiagnoses,
} from "@/features/treatment-management/api/consultingQueries";
import {
  ADVISE_STATUS,
  formatTeeth,
  type PatientAdviseStatus,
} from "@/features/treatment-management/api/consultingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

const { Text } = Typography;


interface AppointmentRow {
  id: string;
  date: string;
  doctorName: string;
  content: string;
  notes: string;
  status: string;
}



export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeeth, setSelectedTeeth] = useState<ToothRecord[]>([]);

  const GENDER_LABELS: Record<string, string> = {
    male: t("Nam"),
    female: t("Nữ"),
    other: t("Khác"),
  };

  const ADVISE_STATUS_CONFIG: Record<PatientAdviseStatus, { label: string; color: string }> = {
    [ADVISE_STATUS.Created]:   { label: t("Chờ duyệt"),   color: "default" },
    [ADVISE_STATUS.Accepted]:  { label: t("Đã chốt"),  color: "blue" },
    [ADVISE_STATUS.Converted]: { label: t("Đã lên KHĐT"), color: "green" },
    [ADVISE_STATUS.Rejected]:  { label: t("Từ chối"),  color: "red" },
    [ADVISE_STATUS.Cancelled]: { label: t("Đã hủy"), color: "default" },
  };

  const APPOINTMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    Scheduled:  { label: t("Đã hẹn"),  color: "#2671D8" },
    Confirmed:  { label: t("Đã xác nhận"),  color: "#3B82F6" },
    CheckedIn:  { label: t("Đã đến"),  color: "#10B981" },
    InProgress: { label: t("Đang khám"), color: "#F97316" },
    Completed:  { label: t("Hoàn thành"),  color: "#10B981" },
    Cancelled:  { label: t("Đã hủy"),  color: "#EF4444" },
    NoShow:     { label: t("Vắng mặt"),     color: "#6B7280" },
  };

  const APPOINTMENT_COUNTER_CARDS = [
    { key: "scheduled", label: t("Đã hẹn"), borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
    { key: "arrived",   label: t("Đã đến"),   borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
    { key: "cancelled", label: t("Đã huỷ"), borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
    { key: "late",      label: t("Trễ hẹn"),      borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
  ];

  const activeTab = searchParams.get("tab") ?? "profile";
  const { data: patient, isLoading } = usePatient(id ?? "");

  const { data: appointmentsData } = useAppointmentList({ patientId: id, maxResultCount: 50 });
  const { data: treatmentPlans } = useTreatmentPlanList({ patientId: id });
  const { data: invoices } = usePatientInvoices(id ?? "");
  const { data: laboOrders } = usePatientLaboOrders(id ?? "");
  const { data: careRecords } = useCareRecordList({ patientId: id, maxResultCount: 50 });
  const { data: prescriptions } = usePatientPrescriptions(id ?? "");
  const appointments = appointmentsData?.items ?? [];
  const plans = treatmentPlans?.items ?? [];
  const patientInvoices = invoices ?? [];
  const patientLaboOrders = laboOrders ?? [];
  const patientCareRecords = careRecords?.items ?? [];
  const patientPrescriptions = prescriptions ?? [];

  const branchId = useCurrentBranchId();
  const consultingParams = { patientId: id ?? "", clinicBranchId: branchId, maxResultCount: 50 };
  const { data: diagnosisPage, isLoading: diagnosesLoading } = usePatientDiagnoses(consultingParams);
  const { data: advisePage, isLoading: advisesLoading } = usePatientAdvises(consultingParams);
  const { data: adviseSummary } = usePatientAdviseSummary(consultingParams);

  const diagnosisRows = diagnosisPage?.items ?? [];
  const adviseRows = advisePage?.items ?? [];

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
      title: t("Ngày / Giờ"),
      dataIndex: "date",
      key: "date",
      width: 140,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{formatDateTime(v)}</Text>,
    },
    { title: t("Bác sĩ phụ trách"), dataIndex: "doctorName", key: "doctorName", width: 160 },
    { title: t("Nội dung"), dataIndex: "content", key: "content" },
    { title: t("Ghi chú"), dataIndex: "notes", key: "notes", width: 180 },
    {
      title: t("Trạng thái"),
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
      title: t("Thao tác"),
      key: "actions",
      width: 80,
      render: () => <Button type="text" size="small" icon={<EditOutlined />} />,
    },
  ];

  const TAB_ITEMS = [
    {
      key: "profile",
      label: t("Hồ sơ"),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Row gutter={20}>
            {/* Left: patient info */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{t("Thông tin bệnh nhân")}</span>
                    <Button type="text" size="small" icon={<EditOutlined />} />
                  </div>
                }
                size="small"
                style={{ marginBottom: 16 }}
              >
                <table style={{ width: "100%", borderSpacing: "0 8px", fontSize: 13 }}>
                  <tbody>
                    {[
                      { label: t("Mã BN"), value: `[${patient.code}]` },
                      { label: t("Họ và tên"), value: patient.fullName },
                      { label: t("Ngày sinh"), value: formatDate(patient.dateOfBirth) },
                      { label: t("Giới tính"), value: GENDER_LABELS[patient.gender] },
                      { label: t("Số điện thoại"), value: patient.phone },
                      { label: t("Email"), value: patient.email ?? "—" },
                      { label: t("Địa chỉ"), value: patient.address ?? "—" },
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
                  <div style={{ color: "#5A6B82", fontSize: 12, marginBottom: 6 }}>{t("Nhãn / Tag")}</div>
                  <Space size={4} wrap>
                    <Tag color="blue">{t("Chỉnh Nha")}</Tag>
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
                      { label: t("Tổng chi phí"), value: totalCost,  color: "#1B2A41" },
                      { label: t("Thực thu"),              value: totalPaid,  color: "#10B981" },
                      { label: t("Công nợ"),              value: totalDebt,  color: "#EF4444" },
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
              <Card title={t("Lịch sử điều trị")} size="small">
                <Table
                  size="small"
                  columns={[
                    { title: t("Ngày"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v) },
                    { title: t("Dịch vụ / Thủ thuật"), dataIndex: "service" },
                    { title: t("Bác sĩ"), dataIndex: "doctor", width: 140 },
                    {
                      title: t("Trạng thái"),
                      dataIndex: "status",
                      width: 130,
                      render: () => <Tag color="success">{t("Hoàn thành")}</Tag>,
                    },
                  ]}
                  dataSource={appointments
                    .filter((a) => a.status === "completed")
                    .map((a) => ({
                      key: a.id,
                      date: a.startTime,
                      service: a.reason ?? t("Khám tổng quát"),
                      doctor: a.doctorName,
                      status: a.status,
                    }))}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Chưa có lịch sử điều trị")}</span> }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "consulting",
      label: t("Chẩn đoán & Tư vấn"),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Row gutter={20}>
            {/* Left: dental chart */}
            <Col xs={24} lg={12}>
              <Card
                title={t("Biểu đồ răng")}
                size="small"
                extra={
                  <Space>
                    <Button size="small">{t("Thêm ảnh")}</Button>
                    <Button size="small">{t("Danh mục")}</Button>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Tabs
                  size="small"
                  defaultActiveKey="select"
                  items={[
                    { key: "select", label: t("Chọn Răng") },
                    { key: "upper", label: t("Hàm Trên") },
                    { key: "lower", label: t("Hàm Dưới") },
                    { key: "full", label: t("Nguyên Hàm") },
                  ]}
                />
                <DentalChartView
                  teeth={selectedTeeth}
                  onToothClick={handleToothClick}
                  style={{ marginTop: 8 }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                  {t("Đã chọn:")}{" "}
                  {selectedTeeth.length > 0
                    ? selectedTeeth.map((tooth) => tooth.fdi).join(", ")
                    : t("Chưa chọn răng")}
                </div>
              </Card>
            </Col>

            {/* Right: diagnosis records */}
            <Col xs={24} lg={12}>
              <Card title={t("Phiếu chẩn đoán")} size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  rowKey="id"
                  loading={diagnosesLoading}
                  columns={[
                    { title: t("Số phiếu"), dataIndex: "code", width: 100 },
                    {
                      title: t("Bác sĩ chẩn đoán"),
                      dataIndex: "staffName",
                      width: 160,
                      render: (v: string | null) => v ?? "—",
                    },
                    {
                      title: t("Răng"),
                      key: "teeth",
                      render: (_, row) => formatTeeth(row.teeth),
                    },
                    {
                      title: t("Ghi chú"),
                      dataIndex: "note",
                      render: (v: string | null) => v ?? "—",
                    },
                    {
                      title: t("Thao tác"),
                      key: "actions",
                      width: 110,
                      render: (_, row) => (
                        <Button type="link" size="small" disabled={row.hasTreatmentService}>
                          {row.hasTreatmentService ? t("Đã tạo DV") : t("Tạo Dịch Vụ")}
                        </Button>
                      ),
                    },
                  ]}
                  dataSource={diagnosisRows}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Chưa có phiếu chẩn đoán")}</span> }}
                />
              </Card>

              <Card title={t("Phiếu tư vấn")} size="small">
                <Table
                  size="small"
                  rowKey="id"
                  loading={advisesLoading}
                  columns={[
                    { title: t("Ngày"), dataIndex: "creationTime", width: 100, render: (v: string) => formatDate(v) },
                    {
                      title: t("Dịch vụ"),
                      dataIndex: "serviceName",
                      render: (v: string | null, row: Record<string, unknown>) => v ?? (row.code as string),
                    },
                    { title: t("SL"), dataIndex: "quantity", width: 50, align: "right" as const },
                    { title: t("Đơn giá"), dataIndex: "price", width: 110, align: "right" as const, render: (v: number) => `${formatVND(v)} đ` },
                    {
                      title: t("Thành tiền"),
                      dataIndex: "effectiveAmount",
                      width: 120,
                      align: "right" as const,
                      render: (v: number) => `${formatVND(v)} đ`,
                    },
                    {
                      title: t("Trạng thái"),
                      dataIndex: "status",
                      width: 120,
                      render: (v: PatientAdviseStatus) => (
                        <Tag color={ADVISE_STATUS_CONFIG[v].color}>{ADVISE_STATUS_CONFIG[v].label}</Tag>
                      ),
                    },
                  ]}
                  dataSource={adviseRows as unknown as Record<string, unknown>[]}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Chưa có phiếu tư vấn")}</span> }}
                />

                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginTop: 12,
                  padding: "10px 0", borderTop: "1px solid #E5E7EB",
                }}>
                  <Text strong style={{ fontSize: 13 }}>{t("TỔNG KẾ HOẠCH")}</Text>
                  <Text style={{ fontSize: 13, color: "#5A6B82" }}>
                    {t("Tổng thành tiền:")} {formatVND(adviseSummary?.totalEffectiveAmount ?? 0)} đ
                  </Text>
                  {(adviseSummary?.totalDiscountAmount ?? 0) > 0 && (
                    <Text style={{ fontSize: 13, color: "#5A6B82" }}>
                      {t("Chiết khấu")}: {formatVND(adviseSummary?.totalDiscountAmount ?? 0)} đ
                    </Text>
                  )}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <Button size="small">{t("Thêm kế hoạch điều trị")}</Button>
                    <Button size="small">{t("Tạo báo giá")}</Button>
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
      label: t("Kế hoạch điều trị"),
      icon: <FileTextOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
            <Button icon={<PlusOutlined />}>{t("Tạo kế hoạch mới")}</Button>
            <Button>{t("Xem tất cả dịch vụ")}</Button>
          </div>

          {/* Summary cards */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card size="small" style={{ borderLeft: "4px solid #2671D8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#2671D8", color: "#fff", borderRadius: 12, padding: "2px 10px", fontWeight: 700, fontSize: 14 }}>0</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41" }}>{t("Dịch vụ đang điều trị")}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("Chưa có dịch vụ đang điều trị")}</div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" style={{ borderLeft: "4px solid #10B981" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 4 }}>{t("Dịch vụ có công đoạn gần nhất")}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("Chưa có công đoạn")}</div>
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
                { title: t("Thêm công đoạn"), key: "addStep", width: 120, render: () => <Button size="small" type="link">+ {t("Công đoạn")}</Button> },
                { title: t("Số phiếu"), dataIndex: "code", key: "code", width: 80, render: (v: string) => <Button type="link" size="small">{v}</Button> },
                { title: t("Dịch vụ"), dataIndex: "serviceName", key: "serviceName", width: 200 },
                { title: t("Bác sĩ tiếp nhận"), dataIndex: "doctorName", key: "doctorName", width: 140 },
                { title: t("Trạng thái"), dataIndex: "status", key: "status", width: 140, render: (v: string) => v ? <Tag color="processing">{v}</Tag> : null },
                { title: t("Ngày tạo hồ sơ"), dataIndex: "createdAt", key: "createdAt", width: 110, render: (v: string) => v ? formatDate(v) : "—" },
                { title: t("Tổng phiếu"), dataIndex: "totalAmount", key: "totalAmount", width: 120, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("Giảm giá"), dataIndex: "discountAmount", key: "discountAmount", width: 110, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("Thành tiền"), dataIndex: "finalAmount", key: "finalAmount", width: 120, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("Đã trả"), dataIndex: "paidAmount", key: "paidAmount", width: 110, align: "right", render: (v: number) => <Text style={{ color: "#10B981" }}>{formatVND(v ?? 0)} đ</Text> },
                { title: t("Hoàn tiền"), dataIndex: "refundedAmount", key: "refundedAmount", width: 100, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("Còn lại"), dataIndex: "remainingAmount", key: "remainingAmount", width: 120, align: "right", render: (v: number) => <Text style={{ color: "#EF4444" }}>{formatVND(v ?? 0)} đ</Text> },
                { title: t("Phải thu"), dataIndex: "toCollect", key: "toCollect", width: 110, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("Thao tác"), key: "actions", width: 80, fixed: "right", render: () => <Space size={4}><Button type="text" size="small" icon={<EditOutlined />} /></Space> },
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
              pagination={{ pageSize: 20, showTotal: (total, range) => `${range[0]}–${range[1]} / ${total}` }}
              scroll={{ x: 1400 }}
              locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Chưa có kế hoạch điều trị")}</span> }}
            />
          </Card>
        </div>
      ),
    },
    {
      key: "appointment",
      label: t("Lịch hẹn"),
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
              content: a.reason ?? t("Khám tổng quát"),
              notes: a.notes ?? "—",
              status: a.status,
            }))}
            pagination={{ pageSize: 20, showTotal: (tot, r) => `${r[0]}–${r[1]} / ${tot}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Chưa có lịch hẹn nào")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "image",
      label: t("Hình ảnh"),
      icon: <PictureOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <Select
              placeholder={t("Giai đoạn điều trị")}
              style={{ width: 220 }}
              allowClear
              options={[
                { value: "Draft", label: t("Bản nháp") },
                { value: "PendingApproval", label: t("Chờ duyệt") },
                { value: "Active", label: t("Đang điều trị") },
                { value: "Completed", label: t("Hoàn thành") },
                { value: "Cancelled", label: t("Đã hủy") },
              ]}
            />
            <Button icon={<UploadOutlined />} style={{ marginLeft: "auto" }}>{t("Tải ảnh")}</Button>
          </div>
          <div style={{ padding: "60px 0", textAlign: "center", color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
            <PictureOutlined style={{ fontSize: 40, marginBottom: 12, color: "#D1D5DB" }} />
            <div style={{ fontWeight: 500, color: "#6B7280", marginBottom: 4 }}>{t("Không có ảnh trong bộ lọc đã chọn")}</div>
            <div style={{ fontSize: 13 }}>{t("Hãy đổi bộ lọc hoặc tải thêm ảnh để tiếp tục.")}</div>
          </div>
        </div>
      ),
    },
    {
      key: "labo",
      label: t("Labo"),
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Top bar: counter filter buttons + create button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            {[
              { label: t("Đơn hàng mới"), count: 0, bg: "#E6F4EA", text: "#10B981", border: "#10B981" },
              { label: t("Tiếp tục công đoạn"), count: 0, bg: "#FEF3C7", text: "#D97706", border: "#F59E0B" },
              { label: t("Bảo hành"), count: 0, bg: "#FCE8E6", text: "#DC2626", border: "#EF4444" },
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
              {t("Tạo phiếu Labo")}
            </Button>
          </div>

          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: t("Mã phiếu labo"), dataIndex: "code", key: "code", width: 120 },
              { title: t("Ngày gửi / Tình trạng mẫu"), dataIndex: "sentAt", key: "sentAt", width: 160, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("Ngày giao / Trạng thái Labo"), dataIndex: "deliveredAt", key: "deliveredAt", width: 170, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("Bác sĩ chỉ định"), dataIndex: "doctorName", key: "doctorName", width: 140 },
              { title: t("Nhà cung cấp"), dataIndex: "supplierName", key: "supplierName", width: 140 },
              { title: t("Vật liệu"), dataIndex: "material", key: "material", width: 120 },
              { title: t("Số răng"), dataIndex: "toothNumbers", key: "toothNumbers", width: 100 },
              { title: t("Số lượng"), dataIndex: "quantity", key: "quantity", width: 80, align: "right" },
              { title: t("File Labo gửi về"), dataIndex: "returnedFile", key: "returnedFile", width: 130 },
              { title: t("Thao tác"), key: "actions", width: 80, render: () => <Button type="text" size="small" icon={<EditOutlined />} /> },
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
            pagination={{ pageSize: 20, showTotal: (total) => t("Hiển thị {0} mẫu labo", total) }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Không có dữ liệu")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "prescription",
      label: t("Đơn thuốc"),
      icon: <MedicineBoxOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} style={{ background: "#2671D8" }}>{t("Tạo đơn thuốc")}</Button>
          </div>
          <Table
            size="small"
            columns={[
              { title: t("Thuốc"), dataIndex: "medicationName", key: "medicationName", render: (v: string) => v || "—" },
              { title: t("Liều dùng"), dataIndex: "dosage", key: "dosage", width: 120 },
              { title: t("Tần suất"), dataIndex: "frequency", key: "frequency", width: 120 },
              { title: t("Số ngày"), dataIndex: "durationDays", key: "durationDays", width: 80, align: "right" as const },
              { title: t("Hướng dẫn"), dataIndex: "instructions", key: "instructions", render: (v: string) => v || "—" },
              { title: t("Trạng thái"), dataIndex: "status", key: "status", width: 120 },
              { title: t("Ngày kê"), dataIndex: "issuedAt", key: "issuedAt", width: 120, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("Thao tác"), key: "actions", width: 80, render: () => <Button type="text" size="small" icon={<EditOutlined />} /> },
            ]}
            dataSource={patientPrescriptions}
            rowKey="id"
            pagination={{ pageSize: 20, showTotal: (total) => `0 / ${total}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Không có đơn thuốc")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "care",
      label: t("Chăm sóc KH"),
      icon: <PhoneOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Status filter buttons + action button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: t("Đã chăm sóc"), count: 0 },
              { label: t("Tốt"), count: 0 },
              { label: t("Khá"), count: 0 },
              { label: t("Bình thường"), count: 0 },
              { label: t("Khiếu nại"), count: 0 },
              { label: t("Đặc biệt"), count: 0 },
              { label: t("Định kỳ"), count: 0 },
              { label: t("Cơ bản"), count: 0 },
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
            <Button style={{ marginLeft: "auto" }}>{t("CSKH đặc biệt")}</Button>
          </div>

          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: t("Ngày chăm sóc"), dataIndex: "careDate", key: "careDate", width: 130, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("Trạng thái CSKH"), dataIndex: "careStatus", key: "careStatus", width: 140 },
              { title: t("Nhóm"), dataIndex: "group", key: "group", width: 160 },
              { title: t("Dịch vụ"), dataIndex: "serviceName", key: "serviceName", width: 180 },
              { title: t("Nội dung"), dataIndex: "content", key: "content" },
              { title: t("Bác sĩ điều trị"), dataIndex: "doctorName", key: "doctorName", width: 140 },
              { title: t("Nhân viên chăm sóc"), dataIndex: "staffName", key: "staffName", width: 150 },
              { title: t("Đánh giá"), dataIndex: "rating", key: "rating", width: 100 },
              { title: t("Thao tác"), key: "actions", width: 100, render: () => <Space size={4}><Button type="text" size="small" icon={<EditOutlined />} /></Space> },
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
            pagination={{ pageSize: 20, showTotal: (total) => `0 / ${total}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Chưa có dữ liệu chăm sóc")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "invoice",
      label: t("Hóa đơn"),
      icon: <DollarOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: t("Số hóa đơn"), dataIndex: "invoiceNumber", key: "invoiceNumber", width: 140 },
              { title: t("Ngày tạo hồ sơ"), dataIndex: "issuedDate", key: "issuedDate", width: 120, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("Thành tiền"), dataIndex: "totalAmount", key: "totalAmount", width: 140, align: "right" as const,
                render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: t("Đã trả"), dataIndex: "paidAmount", key: "paidAmount", width: 140, align: "right" as const,
                render: (v: number) => <Text style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: t("Trạng thái"), dataIndex: "status", key: "status", width: 120,
                render: (s: string) => <Tag color={s === "Paid" ? "success" : s === "Draft" ? "default" : "warning"}>{s}</Tag> },
            ]}
            dataSource={patientInvoices}
            pagination={{ pageSize: 20, showTotal: (tot, r) => `${r[0]}–${r[1]} / ${tot}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Chưa có hóa đơn")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "debt-history",
      label: t("Lịch sử dư nợ"),
      icon: <HistoryOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: t("Ngày giao dịch"), dataIndex: "transactionDate", key: "transactionDate", width: 160, render: (v: string) => v ? formatDateTime(v) : "—" },
              { title: t("Loại"), dataIndex: "type", key: "type", width: 140 },
              { title: t("Số tiền"), dataIndex: "amount", key: "amount", width: 140, align: "right", render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: t("Nhân viên"), dataIndex: "staffName", key: "staffName", width: 160 },
              { title: t("Ghi chú"), dataIndex: "notes", key: "notes" },
            ]}
            dataSource={(patientInvoices ?? []).map((inv) => ({
              id: inv.id,
              transactionDate: inv.issuedAt,
              type:
                inv.status === INVOICE_STATUS.Paid
                  ? t("Thanh toán")
                  : inv.status === INVOICE_STATUS.Voided
                    ? t("Huỷ")
                    : t("Hóa đơn"),
              amount: inv.totalAmount - inv.paidAmount,
              staffName: "—",
              notes: `${inv.invoiceNumber} — ${inv.status}`,
            })).filter((r) => r.amount > 0)}
            pagination={{ pageSize: 20, showTotal: (total, range) => t("Hiển thị {0}–{1} trên {2} giao dịch", range[0], range[1], total) }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("Chưa có lịch sử dư nợ")}</span> }}
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
          {t("Quay lại")}
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
