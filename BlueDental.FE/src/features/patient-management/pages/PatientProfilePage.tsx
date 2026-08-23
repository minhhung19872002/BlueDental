import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTeeth, setSelectedTeeth] = useState<ToothRecord[]>([]);

  const GENDER_LABELS: Record<string, string> = {
    male: t("patient.genderMale"),
    female: t("patient.genderFemale"),
    other: t("patient.genderOther"),
  };

  const ADVISE_STATUS_CONFIG: Record<PatientAdviseStatus, { label: string; color: string }> = {
    [ADVISE_STATUS.Created]:   { label: t("patient.adviseCreated"),   color: "default" },
    [ADVISE_STATUS.Accepted]:  { label: t("patient.adviseAccepted"),  color: "blue" },
    [ADVISE_STATUS.Converted]: { label: t("patient.adviseConverted"), color: "green" },
    [ADVISE_STATUS.Rejected]:  { label: t("patient.adviseRejected"),  color: "red" },
    [ADVISE_STATUS.Cancelled]: { label: t("patient.adviseCancelled"), color: "default" },
  };

  const APPOINTMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    Scheduled:  { label: t("patient.apptStatusScheduled"),  color: "#2671D8" },
    Confirmed:  { label: t("patient.apptStatusConfirmed"),  color: "#3B82F6" },
    CheckedIn:  { label: t("patient.apptStatusCheckedIn"),  color: "#10B981" },
    InProgress: { label: t("patient.apptStatusInProgress"), color: "#F97316" },
    Completed:  { label: t("patient.apptStatusCompleted"),  color: "#10B981" },
    Cancelled:  { label: t("patient.apptStatusCancelled"),  color: "#EF4444" },
    NoShow:     { label: t("patient.apptStatusNoShow"),     color: "#6B7280" },
  };

  const APPOINTMENT_COUNTER_CARDS = [
    { key: "scheduled", label: t("patient.apptCountScheduled"), borderColor: "#1E70E6", bgColor: "#EBF3FE", textColor: "#1E70E6" },
    { key: "arrived",   label: t("patient.apptCountArrived"),   borderColor: "#10B981", bgColor: "#E6F4EA", textColor: "#10B981" },
    { key: "cancelled", label: t("patient.apptCountCancelled"), borderColor: "#EF4444", bgColor: "#FCE8E6", textColor: "#EF4444" },
    { key: "late",      label: t("patient.apptCountLate"),      borderColor: "#F59E0B", bgColor: "#FEF3C7", textColor: "#F59E0B" },
  ];

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
      title: t("patient.dateTime"),
      dataIndex: "date",
      key: "date",
      width: 140,
      render: (v: string) => <Text style={{ fontSize: 13 }}>{formatDateTime(v)}</Text>,
    },
    { title: t("patient.doctorInCharge"), dataIndex: "doctorName", key: "doctorName", width: 160 },
    { title: t("patient.contentLabel"), dataIndex: "content", key: "content" },
    { title: t("common.note"), dataIndex: "notes", key: "notes", width: 180 },
    {
      title: t("common.status"),
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
      title: t("common.actions"),
      key: "actions",
      width: 80,
      render: () => <Button type="text" size="small" icon={<EditOutlined />} />,
    },
  ];

  const TAB_ITEMS = [
    {
      key: "profile",
      label: t("patient.tabProfile"),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Row gutter={20}>
            {/* Left: patient info */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{t("patient.patientInfo")}</span>
                    <Button type="text" size="small" icon={<EditOutlined />} />
                  </div>
                }
                size="small"
                style={{ marginBottom: 16 }}
              >
                <table style={{ width: "100%", borderSpacing: "0 8px", fontSize: 13 }}>
                  <tbody>
                    {[
                      { label: t("patient.patientCode"), value: `[${patient.code}]` },
                      { label: t("patient.fullName"), value: patient.fullName },
                      { label: t("patient.dob"), value: formatDate(patient.dateOfBirth) },
                      { label: t("patient.gender"), value: GENDER_LABELS[patient.gender] },
                      { label: t("common.phone"), value: patient.phone },
                      { label: t("common.email"), value: patient.email ?? "—" },
                      { label: t("patient.address"), value: patient.address ?? "—" },
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
                  <div style={{ color: "#5A6B82", fontSize: 12, marginBottom: 6 }}>{t("patient.tagLabel")}</div>
                  <Space size={4} wrap>
                    <Tag color="blue">{t("patient.tagOrthodontics")}</Tag>
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
                      { label: t("patient.totalCost"), value: totalCost,  color: "#1B2A41" },
                      { label: t("patient.paid"),              value: totalPaid,  color: "#10B981" },
                      { label: t("patient.debt"),              value: totalDebt,  color: "#EF4444" },
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
              <Card title={t("patient.treatmentHistory")} size="small">
                <Table
                  size="small"
                  columns={[
                    { title: t("report.date"), dataIndex: "date", width: 110, render: (v: string) => formatDate(v) },
                    { title: t("patient.serviceProcedure"), dataIndex: "service" },
                    { title: t("patient.doctor"), dataIndex: "doctor", width: 140 },
                    {
                      title: t("common.status"),
                      dataIndex: "status",
                      width: 130,
                      render: () => <Tag color="success">{t("patient.apptStatusCompleted")}</Tag>,
                    },
                  ]}
                  dataSource={appointments
                    .filter((a) => a.status === "completed")
                    .map((a) => ({
                      key: a.id,
                      date: a.startTime,
                      service: a.reason ?? t("patient.reasonDefault"),
                      doctor: a.doctorName,
                      status: a.status,
                    }))}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noTreatmentHistory")}</span> }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
    {
      key: "consulting",
      label: t("patient.tabConsulting"),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Row gutter={20}>
            {/* Left: dental chart */}
            <Col xs={24} lg={12}>
              <Card
                title={t("patient.dentalChart")}
                size="small"
                extra={
                  <Space>
                    <Button size="small">{t("patient.addImage")}</Button>
                    <Button size="small">{t("patient.catalog")}</Button>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Tabs
                  size="small"
                  defaultActiveKey="select"
                  items={[
                    { key: "select", label: t("patient.selectTooth") },
                    { key: "upper", label: t("patient.upperJaw") },
                    { key: "lower", label: t("patient.lowerJaw") },
                    { key: "full", label: t("patient.fullJaw") },
                  ]}
                />
                <DentalChartView
                  teeth={selectedTeeth}
                  onToothClick={handleToothClick}
                  style={{ marginTop: 8 }}
                />
                <div style={{ marginTop: 8, fontSize: 12, color: "#9CA3AF" }}>
                  {t("patient.selectedTeeth")}{" "}
                  {selectedTeeth.length > 0
                    ? selectedTeeth.map((tooth) => tooth.fdi).join(", ")
                    : t("patient.noToothSelected")}
                </div>
              </Card>
            </Col>

            {/* Right: diagnosis records */}
            <Col xs={24} lg={12}>
              <Card title={t("patient.diagnosisSlip")} size="small" style={{ marginBottom: 16 }}>
                <Table
                  size="small"
                  rowKey="id"
                  loading={diagnosesLoading}
                  columns={[
                    { title: t("patient.slipNumber"), dataIndex: "code", width: 100 },
                    {
                      title: t("patient.diagnosisDoctor"),
                      dataIndex: "staffName",
                      width: 160,
                      render: (v: string | null) => v ?? "—",
                    },
                    {
                      title: t("patient.tooth"),
                      key: "teeth",
                      render: (_, row) => formatTeeth(row.teeth),
                    },
                    {
                      title: t("common.note"),
                      dataIndex: "note",
                      render: (v: string | null) => v ?? "—",
                    },
                    {
                      title: t("common.actions"),
                      key: "actions",
                      width: 110,
                      render: (_, row) => (
                        <Button type="link" size="small" disabled={row.hasTreatmentService}>
                          {row.hasTreatmentService ? t("patient.serviceCreated") : t("patient.createService")}
                        </Button>
                      ),
                    },
                  ]}
                  dataSource={diagnosisRows}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noDiagnosis")}</span> }}
                />
              </Card>

              <Card title={t("patient.consultingSlip")} size="small">
                <Table
                  size="small"
                  rowKey="id"
                  loading={advisesLoading}
                  columns={[
                    { title: t("patient.date"), dataIndex: "creationTime", width: 100, render: (v: string) => formatDate(v) },
                    {
                      title: t("patient.service"),
                      dataIndex: "serviceName",
                      render: (v: string | null, row: Record<string, unknown>) => v ?? (row.code as string),
                    },
                    { title: t("patient.quantity"), dataIndex: "quantity", width: 50, align: "right" as const },
                    { title: t("patient.unitPrice"), dataIndex: "price", width: 110, align: "right" as const, render: (v: number) => `${formatVND(v)} đ` },
                    {
                      title: t("patient.totalAmount"),
                      dataIndex: "effectiveAmount",
                      width: 120,
                      align: "right" as const,
                      render: (v: number) => `${formatVND(v)} đ`,
                    },
                    {
                      title: t("common.status"),
                      dataIndex: "status",
                      width: 120,
                      render: (v: PatientAdviseStatus) => (
                        <Tag color={ADVISE_STATUS_CONFIG[v].color}>{ADVISE_STATUS_CONFIG[v].label}</Tag>
                      ),
                    },
                  ]}
                  dataSource={adviseRows}
                  pagination={false}
                  locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noConsulting")}</span> }}
                />

                <div style={{
                  display: "flex", alignItems: "center", gap: 12, marginTop: 12,
                  padding: "10px 0", borderTop: "1px solid #E5E7EB",
                }}>
                  <Text strong style={{ fontSize: 13 }}>{t("patient.totalPlan")}</Text>
                  <Text style={{ fontSize: 13, color: "#5A6B82" }}>
                    {t("patient.totalEffective")} {formatVND(adviseSummary?.totalEffectiveAmount ?? 0)} đ
                  </Text>
                  {(adviseSummary?.totalDiscountAmount ?? 0) > 0 && (
                    <Text style={{ fontSize: 13, color: "#5A6B82" }}>
                      {t("patient.discount")}: {formatVND(adviseSummary?.totalDiscountAmount ?? 0)} đ
                    </Text>
                  )}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <Button size="small">{t("patient.addTreatmentPlan")}</Button>
                    <Button size="small">{t("patient.createQuote")}</Button>
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
      label: t("patient.tabTreatmentPlan"),
      icon: <FileTextOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Toolbar */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 16 }}>
            <Button icon={<PlusOutlined />}>{t("patient.createNewPlan")}</Button>
            <Button>{t("patient.viewAllServices")}</Button>
          </div>

          {/* Summary cards */}
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card size="small" style={{ borderLeft: "4px solid #2671D8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ background: "#2671D8", color: "#fff", borderRadius: 12, padding: "2px 10px", fontWeight: 700, fontSize: 14 }}>0</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41" }}>{t("patient.servicesInTreatment")}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("patient.noServicesInTreatment")}</div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small" style={{ borderLeft: "4px solid #10B981" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 4 }}>{t("patient.nearestStage")}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{t("patient.noStage")}</div>
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
                { title: t("patient.addStep"), key: "addStep", width: 120, render: () => <Button size="small" type="link">+ {t("patient.step")}</Button> },
                { title: t("patient.slipNumber"), dataIndex: "code", key: "code", width: 80, render: (v: string) => <Button type="link" size="small">{v}</Button> },
                { title: t("patient.service"), dataIndex: "serviceName", key: "serviceName", width: 200 },
                { title: t("patient.receivingDoctor"), dataIndex: "doctorName", key: "doctorName", width: 140 },
                { title: t("common.status"), dataIndex: "status", key: "status", width: 140, render: (v: string) => v ? <Tag color="processing">{v}</Tag> : null },
                { title: t("patient.dateCreated"), dataIndex: "createdAt", key: "createdAt", width: 110, render: (v: string) => v ? formatDate(v) : "—" },
                { title: t("patient.planTotal"), dataIndex: "totalAmount", key: "totalAmount", width: 120, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("patient.planDiscount"), dataIndex: "discountAmount", key: "discountAmount", width: 110, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("patient.planFinal"), dataIndex: "finalAmount", key: "finalAmount", width: 120, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("patient.planPaid"), dataIndex: "paidAmount", key: "paidAmount", width: 110, align: "right", render: (v: number) => <Text style={{ color: "#10B981" }}>{formatVND(v ?? 0)} đ</Text> },
                { title: t("patient.planRefund"), dataIndex: "refundedAmount", key: "refundedAmount", width: 100, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("patient.planRemaining"), dataIndex: "remainingAmount", key: "remainingAmount", width: 120, align: "right", render: (v: number) => <Text style={{ color: "#EF4444" }}>{formatVND(v ?? 0)} đ</Text> },
                { title: t("patient.planToCollect"), dataIndex: "toCollect", key: "toCollect", width: 110, align: "right", render: (v: number) => `${formatVND(v ?? 0)} đ` },
                { title: t("common.actions"), key: "actions", width: 80, fixed: "right", render: () => <Space size={4}><Button type="text" size="small" icon={<EditOutlined />} /></Space> },
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
              locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noPlan")}</span> }}
            />
          </Card>
        </div>
      ),
    },
    {
      key: "appointment",
      label: t("patient.tabAppointment"),
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
              content: a.reason ?? t("patient.reasonDefault"),
              notes: a.notes ?? "—",
              status: a.status,
            }))}
            pagination={{ pageSize: 20, showTotal: (tot, r) => `${r[0]}–${r[1]} / ${tot}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noAppointment")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "image",
      label: t("patient.tabImage"),
      icon: <PictureOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <Select
              placeholder={t("patient.treatmentStage")}
              style={{ width: 220 }}
              allowClear
              options={[
                { value: "Draft", label: t("patient.stageDraft") },
                { value: "PendingApproval", label: t("patient.stagePending") },
                { value: "Active", label: t("patient.stageActive") },
                { value: "Completed", label: t("patient.apptStatusCompleted") },
                { value: "Cancelled", label: t("patient.apptStatusCancelled") },
              ]}
            />
            <Button icon={<UploadOutlined />} style={{ marginLeft: "auto" }}>{t("patient.uploadImage")}</Button>
          </div>
          <div style={{ padding: "60px 0", textAlign: "center", color: "#9CA3AF", border: "1px dashed #E5E7EB", borderRadius: 8 }}>
            <PictureOutlined style={{ fontSize: 40, marginBottom: 12, color: "#D1D5DB" }} />
            <div style={{ fontWeight: 500, color: "#6B7280", marginBottom: 4 }}>{t("patient.noImageInFilter")}</div>
            <div style={{ fontSize: 13 }}>{t("patient.changeFilterOrUpload")}</div>
          </div>
        </div>
      ),
    },
    {
      key: "labo",
      label: t("nav.labo"),
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Top bar: counter filter buttons + create button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            {[
              { label: t("patient.newOrder"), count: 0, bg: "#E6F4EA", text: "#10B981", border: "#10B981" },
              { label: t("patient.continueStage"), count: 0, bg: "#FEF3C7", text: "#D97706", border: "#F59E0B" },
              { label: t("patient.warranty"), count: 0, bg: "#FCE8E6", text: "#DC2626", border: "#EF4444" },
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
              {t("patient.createLaboOrder")}
            </Button>
          </div>

          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: t("patient.laboCode"), dataIndex: "code", key: "code", width: 120 },
              { title: t("patient.sentDateStatus"), dataIndex: "sentAt", key: "sentAt", width: 160, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("patient.deliveryDateStatus"), dataIndex: "deliveredAt", key: "deliveredAt", width: 170, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("labo.assignedDoctor"), dataIndex: "doctorName", key: "doctorName", width: 140 },
              { title: t("labo.supplier"), dataIndex: "supplierName", key: "supplierName", width: 140 },
              { title: t("patient.material"), dataIndex: "material", key: "material", width: 120 },
              { title: t("labo.toothNumber"), dataIndex: "toothNumbers", key: "toothNumbers", width: 100 },
              { title: t("report.quantity"), dataIndex: "quantity", key: "quantity", width: 80, align: "right" },
              { title: t("patient.returnedFile"), dataIndex: "returnedFile", key: "returnedFile", width: 130 },
              { title: t("common.actions"), key: "actions", width: 80, render: () => <Button type="text" size="small" icon={<EditOutlined />} /> },
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
            pagination={{ pageSize: 20, showTotal: (total) => t("labo.showTotal", { total }) }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("common.noData")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "prescription",
      label: t("patient.tabPrescription"),
      icon: <MedicineBoxOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <Button type="primary" icon={<PlusOutlined />} style={{ background: "#2671D8" }}>{t("patient.createPrescription")}</Button>
          </div>
          <Table
            size="small"
            columns={[
              { title: t("patient.medication"), dataIndex: "medicationName", key: "medicationName", render: (v: string) => v || "—" },
              { title: t("patient.dosage"), dataIndex: "dosage", key: "dosage", width: 120 },
              { title: t("patient.frequency"), dataIndex: "frequency", key: "frequency", width: 120 },
              { title: t("patient.durationDays"), dataIndex: "durationDays", key: "durationDays", width: 80, align: "right" as const },
              { title: t("patient.instructions"), dataIndex: "instructions", key: "instructions", render: (v: string) => v || "—" },
              { title: t("common.status"), dataIndex: "status", key: "status", width: 120 },
              { title: t("patient.issuedAt"), dataIndex: "issuedAt", key: "issuedAt", width: 120, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("common.actions"), key: "actions", width: 80, render: () => <Button type="text" size="small" icon={<EditOutlined />} /> },
            ]}
            dataSource={patientPrescriptions}
            rowKey="id"
            pagination={{ pageSize: 20, showTotal: (total) => `0 / ${total}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noPrescription")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "care",
      label: t("patient.tabCare"),
      icon: <PhoneOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Status filter buttons + action button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {[
              { label: t("patient.caredLabel"), count: 0 },
              { label: t("patient.careGood"), count: 0 },
              { label: t("patient.careOk"), count: 0 },
              { label: t("patient.careNormal"), count: 0 },
              { label: t("patient.careComplaint"), count: 0 },
              { label: t("patient.careSpecial"), count: 0 },
              { label: t("patient.carePeriodic"), count: 0 },
              { label: t("patient.careBasic"), count: 0 },
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
            <Button style={{ marginLeft: "auto" }}>{t("patient.careHistory")}</Button>
          </div>

          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: t("cskh.careDate"), dataIndex: "careDate", key: "careDate", width: 130, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("patient.careStatus"), dataIndex: "careStatus", key: "careStatus", width: 140 },
              { title: t("patient.careGroup"), dataIndex: "group", key: "group", width: 160 },
              { title: t("patient.service"), dataIndex: "serviceName", key: "serviceName", width: 180 },
              { title: t("patient.contentLabel"), dataIndex: "content", key: "content" },
              { title: t("cskh.treatingDoctor"), dataIndex: "doctorName", key: "doctorName", width: 140 },
              { title: t("patient.careStaff"), dataIndex: "staffName", key: "staffName", width: 150 },
              { title: t("patient.careRating"), dataIndex: "rating", key: "rating", width: 100 },
              { title: t("common.actions"), key: "actions", width: 100, render: () => <Space size={4}><Button type="text" size="small" icon={<EditOutlined />} /></Space> },
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
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noCareLogs")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "invoice",
      label: t("patient.tabInvoice"),
      icon: <DollarOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: t("patient.invoiceNumber"), dataIndex: "invoiceNumber", key: "invoiceNumber", width: 140 },
              { title: t("patient.dateCreated"), dataIndex: "issuedDate", key: "issuedDate", width: 120, render: (v: string) => v ? formatDate(v) : "—" },
              { title: t("patient.totalAmount"), dataIndex: "totalAmount", key: "totalAmount", width: 140, align: "right" as const,
                render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: t("patient.paidAmount"), dataIndex: "paidAmount", key: "paidAmount", width: 140, align: "right" as const,
                render: (v: number) => <Text style={{ color: "#10B981", fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: t("common.status"), dataIndex: "status", key: "status", width: 120,
                render: (s: string) => <Tag color={s === "Paid" ? "success" : s === "Draft" ? "default" : "warning"}>{s}</Tag> },
            ]}
            dataSource={patientInvoices}
            pagination={{ pageSize: 20, showTotal: (tot, r) => `${r[0]}–${r[1]} / ${tot}` }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noInvoice")}</span> }}
          />
        </div>
      ),
    },
    {
      key: "debt-history",
      label: t("patient.tabDebtHistory"),
      icon: <HistoryOutlined />,
      children: (
        <div style={{ padding: "16px 0" }}>
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: t("patient.transactionDate"), dataIndex: "transactionDate", key: "transactionDate", width: 160, render: (v: string) => v ? formatDateTime(v) : "—" },
              { title: t("report.type"), dataIndex: "type", key: "type", width: 140 },
              { title: t("patient.amount"), dataIndex: "amount", key: "amount", width: 140, align: "right", render: (v: number) => <Text style={{ fontVariantNumeric: "tabular-nums" }}>{formatVND(v ?? 0)} đ</Text> },
              { title: t("patient.staffName"), dataIndex: "staffName", key: "staffName", width: 160 },
              { title: t("common.note"), dataIndex: "notes", key: "notes" },
            ]}
            dataSource={(patientInvoices ?? []).map((inv) => ({
              id: inv.id,
              transactionDate: inv.issuedDate,
              type: inv.status === "Paid" ? t("patient.paymentType") : inv.status === "Voided" ? t("patient.voidType") : t("patient.invoiceType"),
              amount: inv.totalAmount - inv.paidAmount,
              staffName: "—",
              notes: `${inv.invoiceNumber} — ${inv.status}`,
            })).filter((r) => r.amount > 0)}
            pagination={{ pageSize: 20, showTotal: (total, range) => t("report.showRangeTransactions", { from: range[0], to: range[1], total }) }}
            locale={{ emptyText: <span style={{ color: "#9CA3AF" }}>{t("patient.noDebtHistory")}</span> }}
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
          {t("patient.goBack")}
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
