import { useMemo, useState, type ReactNode } from "react";
import { Button, type TableColumnsType } from "antd";
import { useNavigate } from "react-router-dom";
import {
  CalendarOutlined,
  CompassOutlined,
  CreditCardOutlined,
  DollarOutlined,
  EditOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  IdcardOutlined,
  MailOutlined,
  MedicineBoxOutlined,
  PhoneOutlined,
  PlusOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { DataTable } from "@/components/DataTable";
import {
  SERVICE_LINE_STATUS,
  usePatientAccount,
  type TreatmentServiceDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { formatTeeth } from "@/features/treatment-management/api/consultingApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { formatDate, formatVND } from "@/utils/format";
import type { PatientDto } from "../../types/patient";
import { GENDER, type GenderCode } from "../../types/patient";
import { PatientEditorDialog } from "../PatientEditorDialog";
import {
  ExaminationReasonDialog,
  PatientPaymentDialog,
  PatientTagPicker,
  RecallDialog,
} from "./PatientProfileDialogs";

interface Props {
  patient: PatientDto;
}
interface TreatmentRow extends TreatmentServiceDto {
  createdAt: string;
  dentist: string | null;
}

const genderLabels: Record<GenderCode, string> = {
  [GENDER.Male]: "Nam",
  [GENDER.Female]: "Nữ",
  [GENDER.Other]: "Khác",
  [GENDER.PreferNotToSay]: "Không tiết lộ",
};

function ageOf(date: string | null) {
  if (!date) return null;
  const birth = new Date(date);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return age;
}

function InfoItem({
  icon,
  label,
  value,
  wide,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "pd-info pd-info--wide" : "pd-info"}>
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value || "—"}</strong>
      </div>
    </div>
  );
}


/**
 * A fact stated on one line — "Tiểu sử bệnh: Chưa có dữ liệu" — which is how
 * the reference writes the three notes beside the visit reason. The stacked
 * label/value of {@link InfoItem} is for the identity card beside it.
 */
function FactItem({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="pd-fact">
      <span>{icon}</span>
      <p>
        <b>{label}:</b> {value || "—"}
      </p>
    </div>
  );
}

/** "Thứ năm, 20-08-2026", as the appointment card names the day. */
function formatWeekday(value: string) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "—";
  const weekday = at.toLocaleDateString("vi-VN", { weekday: "long" });
  const day = String(at.getDate()).padStart(2, "0");
  const month = String(at.getMonth() + 1).padStart(2, "0");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}-${month}-${at.getFullYear()}`;
}

function formatClock(value: string) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "--:--";
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
}

function minutesBetween(from: string, to: string | null | undefined) {
  if (!to) return 0;
  const minutes = (new Date(to).getTime() - new Date(from).getTime()) / 60000;
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 0;
}

/**
 * Đã đến → Đang khám → Hoàn tất.
 *
 * The times are left as "--:--" rather than guessed: an appointment records
 * when it was booked for, not when the patient walked in, and the reference
 * fills these from reception. See docs/clone/pages/patient-detail.md.
 */
function receptionSteps(status: string) {
  const reachedUpTo =
    status === "completed" ? 3 : status === "inProgress" ? 2 : status === "confirmed" ? 1 : 0;

  return [
    { label: "Đã đến", at: null as string | null, reached: reachedUpTo >= 1 },
    { label: "Đang khám", at: null as string | null, reached: reachedUpTo >= 2 },
    { label: "Hoàn tất", at: null as string | null, reached: reachedUpTo >= 3 },
  ];
}

export function PatientProfileTab({ patient }: Props) {
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const pagination = useTablePagination(20);
  const { data: account, isLoading } = usePatientAccount(patient.id, branchId);
  const appointmentsQuery = useAppointmentList({ patientId: patient.id, maxResultCount: 50 });
  const appointments = appointmentsQuery.data;
  const sources = useCatalogOptions(CATALOG_GROUP.Source).data ?? [];
  const occupations = useCatalogOptions(CATALOG_GROUP.Occupation).data ?? [];
  const diseases = useCatalogOptions(CATALOG_GROUP.DiseaseHistory).data ?? [];

  const source = sources.find((item) => item.id === patient.sourceEntryId)?.name ?? "—";
  const occupation =
    occupations.find((item) => item.id === patient.occupationEntryId)?.name ??
    patient.occupationOther ??
    "—";
  const disease =
    diseases
      .filter((item) => patient.diseaseHistoryEntryIds.includes(item.id))
      .map((item) => item.name)
      .join(", ") || "—";
  /**
   * The nearest appointment, which is what "Lịch hẹn gần nhất" means: the next
   * one if there is one, otherwise the last one that happened. The reference
   * asks its server for exactly this (`/schedules/latest`, ascending) and
   * shows it whether or not it has already passed — filtering to the future
   * only left the card empty for every patient who is between visits.
   */
  const upcoming = useMemo(() => {
    const live = (appointments?.items ?? []).filter((item) => item.status !== "cancelled");
    const now = Date.now();
    const ahead = live
      .filter((item) => new Date(item.startTime).getTime() >= now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (ahead.length > 0) return ahead[0];

    return live.sort((a, b) => b.startTime.localeCompare(a.startTime))[0];
  }, [appointments]);
  const rows = useMemo<TreatmentRow[]>(
    () =>
      (account?.plans ?? []).flatMap((plan) =>
        plan.services.map((service) => ({
          ...service,
          createdAt: plan.creationTime,
          dentist: plan.dentistName,
        })),
      ),
    [account],
  );
  const visibleRows = rows.filter(
    (row) =>
      filter === "all" ||
      (filter === "done" && row.status === SERVICE_LINE_STATUS.Done) ||
      (filter === "active" && row.status === SERVICE_LINE_STATUS.InProgress),
  );
  const payment = account?.payment;

  const treatmentColumns: TableColumnsType<TreatmentRow> = [
    { title: t("Ngày"), dataIndex: "createdAt", width: 105, render: formatDate },
    {
      title: t("Dịch vụ"),
      dataIndex: "serviceName",
      width: 170,
      render: (value: string | null, row) => value ?? row.code,
    },
    {
      title: t("Nội dung điều trị"),
      dataIndex: "serviceName",
      width: 180,
      render: (value: string | null) => value ?? "—",
    },
    { title: t("Răng"), dataIndex: "teeth", width: 90, render: formatTeeth },
    { title: t("SL"), dataIndex: "quantity", width: 55, align: "center" },
    {
      title: t("Bác sĩ điều trị"),
      dataIndex: "dentist",
      width: 145,
      render: (value: string | null) => value ?? "—",
    },
    { title: t("Bác sĩ hỗ trợ"), width: 130, render: () => "—" },
    {
      title: t("Công đoạn"),
      width: 105,
      render: (_, row) => `${row.completedStageCount}/${row.stageCount}`,
    },
    {
      title: t("Thao tác"),
      width: 80,
      fixed: "right",
      render: () => (
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          aria-label={t("Mở kế hoạch điều trị")}
          onClick={() => navigate(`?tab=treatment-plan&branchId=${branchId}`)}
        />
      ),
    },
  ];

  const money = [
    ["Tổng dự kiến thu", payment?.totalPrice ?? 0, <DollarOutlined />, "blue"],
    ["Đã thu", payment?.totalPaid ?? 0, <WalletOutlined />, "green"],
    ["Dự kiến thu còn lại", payment?.totalDue ?? 0, <CreditCardOutlined />, "red"],
    ["Dư nợ", payment?.outstandingDebt ?? 0, <WalletOutlined />, "navy"],
    ["Phải thu", payment?.receivable ?? 0, <DollarOutlined />, "red"],
    ["Đã hoàn", payment?.totalRefund ?? 0, <WalletOutlined />, "orange"],
  ] as const;

  return (
    <section className="pd-pane pd-profile">
      <div className="pd-profile-card">
        <div className="pd-profile-column pd-profile-main">
          <div className="pd-profile-title">
            <strong>
              ({patient.patientCode}) - {patient.fullName}
            </strong>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setEditing(true)}
              aria-label={t("Chỉnh sửa hồ sơ")}
            />
            <PatientTagPicker patient={patient} />
          </div>
          <div className="pd-info-grid">
            <InfoItem
              icon={<CalendarOutlined />}
              label={t("Ngày sinh")}
              value={`${formatDate(patient.dateOfBirth)}${ageOf(patient.dateOfBirth) === null ? "" : ` (${ageOf(patient.dateOfBirth)} tuổi)`}`}
            />
            <InfoItem
              icon={<PhoneOutlined />}
              label={t("Số điện thoại")}
              value={patient.phoneNumber}
            />
            <InfoItem icon={<MailOutlined />} label="Email" value={patient.email} />
            <InfoItem
              icon={<UserOutlined />}
              label={t("Giới tính")}
              value={t(genderLabels[patient.gender])}
            />
            <InfoItem icon={<IdcardOutlined />} label="CCCD" value={patient.nationalId} />
            <InfoItem icon={<MedicineBoxOutlined />} label={t("Nghề nghiệp")} value={occupation} />
            <InfoItem
              wide
              icon={<EnvironmentOutlined />}
              label={t("Địa chỉ")}
              value={patient.address}
            />
          </div>
        </div>
        <div className="pd-profile-column">
          <h3>
            {t("LÝ DO ĐẾN KHÁM")}{" "}
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setReasonOpen(true)}
            />
          </h3>
          {/* The reference dates this line from the visit that raised it.
              BlueDental keeps the reason on the patient with no date of its
              own — see docs/clone/pages/patient-detail.md. */}
          <p className="pd-reason">
            <span className="pd-reason-text">
              {patient.examinationReason || t("Chưa có lý do đến khám")}
            </span>
          </p>
          <FactItem
            icon={<MedicineBoxOutlined />}
            label={t("Tiểu sử bệnh")}
            value={disease === "—" ? t("Chưa có dữ liệu") : disease}
          />
          <FactItem
            icon={<EyeOutlined />}
            label={t("Về KH")}
            value={patient.note || t("Chưa có ghi chú")}
          />
          <FactItem icon={<CompassOutlined />} label={t("Nguồn đến")} value={source} />
        </div>
        <div className="pd-profile-column pd-next-appointment">
          <h3>
            {t("LỊCH HẸN GẦN NHẤT")}{" "}
            <Button
              type="primary"
              shape="circle"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setCreatingAppointment(true)}
              aria-label={t("Tạo lịch hẹn mới")}
            />
          </h3>
          {upcoming ? (
            <>
              <dl className="pd-appt-facts">
                <dt>{t("Ngày")}:</dt>
                <dd>{formatWeekday(upcoming.startTime)}</dd>
                <dt>{t("Giờ hẹn")}:</dt>
                <dd>
                  {formatClock(upcoming.startTime)}
                  {minutesBetween(upcoming.startTime, upcoming.endTime) > 0 &&
                    ` (${minutesBetween(upcoming.startTime, upcoming.endTime)} ${t("phút")})`}
                </dd>
                <dt>{t("Bác sĩ")}:</dt>
                <dd className="pd-appt-doctor">{upcoming.doctorName ?? "—"}</dd>
                <dt>{t("Nội dung")}:</dt>
                <dd>{upcoming.reason || t("Khám tổng quát")}</dd>
              </dl>

              <p className="pd-appt-steps-title">{t("Tiếp nhận")}</p>
              <ol className="pd-appt-steps">
                {receptionSteps(upcoming.status).map((step, index) => (
                  <li key={step.label} className={step.reached ? "reached" : undefined}>
                    <span className="pd-appt-step-dot">{index + 1}</span>
                    <span className="pd-appt-step-label">{t(step.label)}</span>
                    <span className="pd-appt-step-time">{step.at ?? "--:--"}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <div className="pd-empty-compact">
              <CalendarOutlined />
              <span>{t("Chưa có lịch hẹn sắp tới")}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pd-money-grid">
        {money.map(([label, value, icon, tone]) => (
          <div className={`pd-money pd-money--${tone}`} key={label}>
            <span>{icon}</span>
            <div>
              <strong>{formatVND(value)} đ</strong>
              <small>{t(label)}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="bd-cat-card">
        <div className="pd-table-toolbar">
          <div className="pd-filter-pills">
            {[
              ["all", "Tất cả"],
              ["done", "Điều trị hoàn tất"],
              ["active", "Đang điều trị"],
              ["diagnosis", "Các chẩn đoán"],
              ["recall", "Tái khám"],
              ["warranty", "Bảo hành"],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
              >
                {t(label)}
              </button>
            ))}
          </div>
          <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setRecallOpen(true)}>
              {t("Tạo Tái khám")}
            </Button>
            <Button
              className="pd-btn-outline"
              icon={<DollarOutlined />}
              onClick={() => setPaymentOpen(true)}
            >
              {t("Thanh toán")}
            </Button>
          </div>
        </div>
        <DataTable<TreatmentRow>
          loading={isLoading}
          rowKey="id"
          size="small"
          columns={treatmentColumns}
          dataSource={visibleRows.slice(
            pagination.skipCount,
            pagination.skipCount + pagination.pageSize,
          )}
          locale={{ emptyText: t("Chưa có điều trị") }}
          pagination={pagination.buildConfig(visibleRows.length, countedTotal(t("điều trị")))}
        />
      </div>
      <PatientEditorDialog open={editing} patient={patient} onClose={() => setEditing(false)} />
      <ExaminationReasonDialog
        open={reasonOpen}
        patient={patient}
        onClose={() => setReasonOpen(false)}
      />
      <RecallDialog open={recallOpen} onClose={() => setRecallOpen(false)} />
      <PatientPaymentDialog
        open={paymentOpen}
        payments={account?.payments ?? []}
        total={account?.payment.totalPaid ?? 0}
        onClose={() => setPaymentOpen(false)}
      />
      <AppointmentEditorModal
        open={creatingAppointment}
        initialPatientId={patient.id}
        lockPatient
        onClose={() => setCreatingAppointment(false)}
        onSuccess={() => void appointmentsQuery.refetch()}
      />
    </section>
  );
}
