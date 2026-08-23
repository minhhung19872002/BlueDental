import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button, Spin, Tabs, Tag, Row, Col, Card, Table, Typography, Space, message,
} from "antd";
import {
  ArrowLeftOutlined, EditOutlined, CalendarOutlined,
  FileTextOutlined, PictureOutlined, MedicineBoxOutlined,
  PhoneOutlined, DollarOutlined, HistoryOutlined,
} from "@ant-design/icons";
import { usePatient } from "../api/patientQueries";
import { formatDate, formatVND } from "@/utils/format";
import {
  useAcceptAdvise,
  usePatientAdviseSummary,
  usePatientAdvises,
  usePatientDiagnoses,
} from "@/features/treatment-management/api/consultingQueries";
import {
  ADVISE_STATUS,
  formatTeeth,
  type PatientAdviseStatus,
  type ToothSelectionDto,
} from "@/features/treatment-management/api/consultingApi";
import { ToothSurfaceChart } from "@/features/treatment-management/components/ToothSurfaceChart";
import { DiagnosisModal } from "@/features/treatment-management/components/DiagnosisModal";
import { AdviseModal } from "@/features/treatment-management/components/AdviseModal";
import { TreatmentStagePanel } from "@/features/treatment-management/components/TreatmentStagePanel";
import { TreatmentPlanPanel } from "@/features/treatment-management/components/TreatmentPlanPanel";
import { PatientAccountPanel } from "@/features/treatment-management/components/PatientAccountPanel";
import { PatientDebtHistoryPanel } from "@/features/treatment-management/components/PatientDebtHistoryPanel";
import { PrescriptionPanel } from "@/features/treatment-management/components/PrescriptionPanel";
import { PatientAppointmentPanel } from "@/features/appointments/components/PatientAppointmentPanel";
import { PatientLaboPanel } from "@/features/labo/components/PatientLaboPanel";
import { PatientCarePanel } from "@/features/cskh/components/PatientCarePanel";
import { PatientImagePanel } from "../components/PatientImagePanel";
import type { PatientDiagnosisDto } from "@/features/treatment-management/api/consultingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";

const { Text } = Typography;

const GENDER_LABELS: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" };

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/** "Hàm Trên / Hàm Dưới / Nguyên Hàm" shortcuts, as on the reference toolbar. */
function selectWholeJaw(jaw: "upper" | "lower" | "full"): ToothSelectionDto[] {
  const codes =
    jaw === "upper" ? UPPER_TEETH : jaw === "lower" ? LOWER_TEETH : [...UPPER_TEETH, ...LOWER_TEETH];

  return codes.map((toothCode) => ({
    toothCode,
    selected: true,
    top: false,
    right: false,
    bottom: false,
    left: false,
    center: false,
  }));
}

const ADVISE_STATUS_CONFIG: Record<PatientAdviseStatus, { label: string; color: string }> = {
  [ADVISE_STATUS.Created]:   { label: "Chờ duyệt",   color: "default" },
  [ADVISE_STATUS.Accepted]:  { label: "Đã chốt",     color: "blue" },
  [ADVISE_STATUS.Converted]: { label: "Đã lên KHĐT", color: "green" },
  [ADVISE_STATUS.Rejected]:  { label: "Từ chối",     color: "red" },
  [ADVISE_STATUS.Cancelled]: { label: "Đã hủy",      color: "default" },
};


export function PatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // The consulting tab records surfaces, not a per-tooth status, so it keeps its
  // own selection shaped like the API's ToothSelection.
  const [consultingTeeth, setConsultingTeeth] = useState<ToothSelectionDto[]>([]);
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [adviseFor, setAdviseFor] = useState<PatientDiagnosisDto | null>(null);

  const acceptAdvise = useAcceptAdvise();

  const handleAcceptAdvise = async (adviseId: string) => {
    try {
      await acceptAdvise.mutateAsync(adviseId);
      message.success("Đã chấp nhận phiếu tư vấn");
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const activeTab = searchParams.get("tab") ?? "profile";
  const { data: patient, isLoading } = usePatient(id ?? "");

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

  if (isLoading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: 300 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!patient) return null;

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
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <Button size="small" onClick={() => setConsultingTeeth(selectWholeJaw("upper"))}>
                    Hàm Trên
                  </Button>
                  <Button size="small" onClick={() => setConsultingTeeth(selectWholeJaw("lower"))}>
                    Hàm Dưới
                  </Button>
                  <Button size="small" onClick={() => setConsultingTeeth(selectWholeJaw("full"))}>
                    Nguyên Hàm
                  </Button>
                  <Button size="small" onClick={() => setConsultingTeeth([])}>
                    Bỏ chọn
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    disabled={consultingTeeth.length === 0}
                    onClick={() => setDiagnosisModalOpen(true)}
                  >
                    Tạo phiếu chẩn đoán
                  </Button>
                </div>

                <ToothSurfaceChart
                  value={consultingTeeth}
                  onChange={setConsultingTeeth}
                  style={{ marginTop: 8 }}
                />

                <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                  Đã chọn: {consultingTeeth.length > 0 ? formatTeeth(consultingTeeth) : "Chưa chọn răng"}
                </div>
              </Card>
            </Col>

            {/* Right: diagnosis records */}
            <Col xs={24} lg={12}>
              <Card title="Phiếu chẩn đoán" size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  rowKey="id"
                  loading={diagnosesLoading}
                  columns={[
                    { title: "Số phiếu", dataIndex: "code", width: 100 },
                    {
                      title: "Bác sĩ chẩn đoán",
                      dataIndex: "staffName",
                      width: 160,
                      render: (v: string | null) => v ?? "—",
                    },
                    {
                      title: "Răng",
                      key: "teeth",
                      render: (_, row) => formatTeeth(row.teeth),
                    },
                    {
                      title: "Ghi chú",
                      dataIndex: "note",
                      render: (v: string | null) => v ?? "—",
                    },
                    {
                      title: "Thao tác",
                      key: "actions",
                      width: 110,
                      render: (_, row) => (
                        <Button type="link" size="small" onClick={() => setAdviseFor(row)}>
                          Tạo Dịch Vụ
                        </Button>
                      ),
                    },
                  ]}
                  dataSource={diagnosisRows}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có phiếu chẩn đoán</span> }}
                />
              </Card>

              <Card title="Phiếu tư vấn" size="small">
                <Table
                  size="small"
                  rowKey="id"
                  loading={advisesLoading}
                  columns={[
                    { title: "Ngày", dataIndex: "creationTime", width: 100, render: (v) => formatDate(v) },
                    {
                      title: "Dịch vụ",
                      dataIndex: "serviceName",
                      render: (v: string | null, row) => v ?? row.code,
                    },
                    { title: "SL", dataIndex: "quantity", width: 50, align: "right" },
                    { title: "Đơn giá", dataIndex: "price", width: 110, align: "right", render: (v) => `${formatVND(v)} đ` },
                    {
                      title: "Thành tiền",
                      dataIndex: "effectiveAmount",
                      width: 120,
                      align: "right",
                      render: (v) => `${formatVND(v)} đ`,
                    },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      width: 120,
                      render: (v: PatientAdviseStatus) => (
                        <Tag color={ADVISE_STATUS_CONFIG[v].color}>{ADVISE_STATUS_CONFIG[v].label}</Tag>
                      ),
                    },
                    {
                      // Only an accepted line becomes a treatment service, and only a
                      // treatment service can carry công đoạn.
                      title: "Thao tác",
                      key: "actions",
                      width: 110,
                      render: (_, row) =>
                        row.status === ADVISE_STATUS.Created ? (
                          <Button
                            type="link"
                            size="small"
                            loading={acceptAdvise.isPending}
                            onClick={() => handleAcceptAdvise(row.id)}
                          >
                            Chấp nhận
                          </Button>
                        ) : (
                          <Text type="secondary">—</Text>
                        ),
                    },
                  ]}
                  dataSource={adviseRows}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>Chưa có phiếu tư vấn</span> }}
                />

                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginTop: 12,
                  padding: "10px 0", borderTop: "1px solid #E5E7EB",
                }}>
                  <Text strong style={{ fontSize: 13 }}>TỔNG KẾ HOẠCH</Text>
                  <Text style={{ fontSize: 13, color: "#5A6B82" }}>
                    Tổng thành tiền: {formatVND(adviseSummary?.totalEffectiveAmount ?? 0)} đ
                  </Text>
                  {(adviseSummary?.totalDiscountAmount ?? 0) > 0 && (
                    <Text style={{ fontSize: 13, color: "#5A6B82" }}>
                      Chiết khấu: {formatVND(adviseSummary?.totalDiscountAmount ?? 0)} đ
                    </Text>
                  )}
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
          <TreatmentPlanPanel patientId={id ?? ""} />

          {/* Công đoạn — the steps that make up each service line. */}
          <TreatmentStagePanel patientId={id ?? ""} />
        </div>
      ),
    },
    {
      key: "appointment",
      label: "Lịch hẹn",
      icon: <CalendarOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <PatientAppointmentPanel patientId={id ?? ""} />
        </div>
      ),
    },
    {
      key: "image",
      label: "Hình ảnh",
      icon: <PictureOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <PatientImagePanel patientId={id ?? ""} />
        </div>
      ),
    },
    {
      key: "labo",
      label: "Labo",
      icon: <MedicineBoxOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <PatientLaboPanel patientId={id ?? ""} />
        </div>
      ),
    },
    {
      key: "prescription",
      label: "Đơn thuốc",
      icon: <MedicineBoxOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <PrescriptionPanel patientId={id ?? ""} />
        </div>
      ),
    },
    {
      key: "care",
      label: "Chăm sóc KH",
      icon: <PhoneOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <PatientCarePanel patientId={id ?? ""} />
        </div>
      ),
    },
    {
      key: "invoice",
      label: "Hóa đơn",
      icon: <DollarOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <PatientAccountPanel patientId={id ?? ""} />
        </div>
      ),
    },
    {
      key: "debt-history",
      label: "Lịch sử dư nợ",
      icon: <HistoryOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <PatientDebtHistoryPanel patientId={id ?? ""} />
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

      <DiagnosisModal
        open={diagnosisModalOpen}
        patientId={patient.id}
        teeth={consultingTeeth}
        onClose={() => setDiagnosisModalOpen(false)}
        // The teeth are now recorded on the diagnosis, so clear the chart for
        // the next one instead of leaving a stale selection behind.
        onCreated={() => setConsultingTeeth([])}
      />

      <AdviseModal
        open={adviseFor !== null}
        patientId={patient.id}
        diagnosis={adviseFor}
        onClose={() => setAdviseFor(null)}
      />
    </div>
  );
}
