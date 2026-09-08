import { useMemo, useState, type ReactNode } from "react";
import { Button } from "antd";
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
  MoneyCollectOutlined,
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
} from "@/features/treatment-management/api/treatmentPlanApi";
import { useReExaminations, useTreatmentStages } from "@/features/treatment-management/api/stageApi";
import { planDetailPath } from "@/features/treatment-management/components/plan/planTypes";
import { PLAN_TAB } from "@/features/treatment-management/components/plan-detail/planDetailTypes";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { usePatientTagOptions } from "@/hooks/usePatientTagOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { getLocale, t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import type { PatientDto } from "../../types/patient";
import { GENDER, type GenderCode } from "../../types/patient";
import { PatientEditorDialog } from "../PatientEditorDialog";
import { AppointmentDoctorPicker } from "./AppointmentDoctorPicker";
import { ReceptionSteps } from "./ReceptionSteps";
import { CreatePaymentDialog } from "./CreatePaymentDialog";
import { TreatmentStageDialog } from "./TreatmentStageDialog";
import { StageFollowUpDialog } from "./stage/StageFollowUpDialog";
import {
  ExaminationReasonDialog,
  PatientPaymentDialog,
  PatientTagChip,
  PatientTagPicker,
} from "./PatientProfileDialogs";
import { RecallDialog } from "./stage/RecallDialog";
import { ServiceDetailDialog } from "./stage/ServiceDetailDialog";
import { treatmentColumns } from "./treatmentColumns";
import { buildTreatmentRows, regroupByDay, type TreatmentRow } from "./treatmentRows";

interface Props {
  patient: PatientDto;
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
  const weekday = at.toLocaleDateString(getLocale(), { weekday: "long" });
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

export function PatientProfileTab({ patient }: Props) {
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [creatingAppointment, setCreatingAppointment] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payingRow, setPayingRow] = useState<TreatmentRow | null>(null);
  const [stageRow, setStageRow] = useState<TreatmentRow | null>(null);
  const [warrantyRow, setWarrantyRow] = useState<TreatmentRow | null>(null);
  /** The finished công đoạn a "Tạo tái khám" row is acting on. */
  const [recallStageId, setRecallStageId] = useState<string | null>(null);
  const [detailStageId, setDetailStageId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const pagination = useTablePagination(20);
  const { data: account, isLoading } = usePatientAccount(patient.id, branchId);
  /*
   * The whole history in one request, because the table paginates and groups by
   * day in the browser: the công đoạn and the tái khám rows are two collections
   * merged into one ordering, which cannot be paged server-side independently.
   *
   * 1000 is ABP's own MaxMaxResultCount, so this is as much as one request can
   * ask for. It was 200, and because the server orders stages by
   * (TreatmentServiceId, SequenceNumber) rather than by date, the cap dropped
   * whole service lines — a newly added công đoạn simply never appeared in the
   * table, on any page (R-273). Past 1000 rows the same truncation returns; the
   * real fix is the reference's own server-paged timeline endpoint, recorded in
   * docs/clone/unknowns.md.
   */
  const patientStages = useTreatmentStages({
    patientId: patient.id,
    clinicBranchId: branchId,
    maxResultCount: 1000,
  });
  /** Tái khám rows sit in the same table, beside the công đoạn. */
  const reExaminations = useReExaminations({
    patientId: patient.id,
    clinicBranchId: branchId,
    maxResultCount: 1000,
  });
  /** What "Tạo tái khám" can follow: a công đoạn that is actually finished. */
  const finishedStages = (patientStages.data?.items ?? []).filter(
    (stage) => stage.completedAt !== null,
  );
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
   * The tags on this record, in catalog order rather than the order they were
   * ticked — the reference lists them the same way its picker does, so a chip
   * does not move when the tag is removed and put back.
   */
  const tagOptions = usePatientTagOptions(patient.branchId).data;
  const tagsOnRecord = useMemo(
    () => (tagOptions ?? []).filter((tag) => patient.tagIds.includes(tag.value)),
    [patient.tagIds, tagOptions],
  );
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
  // A table row is one công đoạn, the way the reference's timeline reads.
  const rows = useMemo(
    () =>
      buildTreatmentRows(
        account?.plans ?? [],
        patientStages.data?.items ?? [],
        reExaminations.data?.items ?? [],
      ),
    [account, patientStages.data, reExaminations.data],
  );
  const visibleRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          filter === "all" ||
          (filter === "done" && row.status === SERVICE_LINE_STATUS.Done) ||
          (filter === "active" && row.status === SERVICE_LINE_STATUS.InProgress),
      ),
    [rows, filter],
  );
  /*
   * The day spans are positional, and both the filter and the page cut into
   * them, so they are worked out over exactly the rows this page renders.
   * Regrouping before the slice left page two without a date cell for its first
   * day, and let a cell near the foot of a page claim rows that sit on the next
   * one — AntD then swallowed the following day's date.
   */
  const pageRows = useMemo(
    () =>
      regroupByDay(
        visibleRows.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize),
      ),
    [visibleRows, pagination.skipCount, pagination.pageSize],
  );
  const payment = account?.payment;

  const openTreatmentPlan = () => navigate(`?tab=treatment-plan&branchId=${branchId}`);
  const columns = useMemo(
    () =>
      treatmentColumns({
        onOpenPlan: openTreatmentPlan,
        onAddStage: setStageRow,
        onWarranty: setWarrantyRow,
        onPay: setPayingRow,
      }),
    // openTreatmentPlan closes over the branch and the router's navigate only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branchId],
  );
  const planOf = (row: TreatmentRow | null) =>
    (account?.plans ?? []).find((plan) => plan.id === row?.treatmentPlanId) ?? null;
  const payingPlan = planOf(payingRow);
  const stagePlan = planOf(stageRow);

  // Seven tiles, in the reference's order and colours.
  const money = [
    ["Tổng dự kiến thu", payment?.totalPrice ?? 0, <DollarOutlined />, "blue"],
    ["Đã thu", payment?.totalPaid ?? 0, <WalletOutlined />, "green"],
    ["Dự kiến thu còn lại", payment?.totalDue ?? 0, <CreditCardOutlined />, "red"],
    ["Dư nợ", payment?.outstandingDebt ?? 0, <WalletOutlined />, "navy"],
    ["Phải thu", payment?.receivable ?? 0, <DollarOutlined />, "red"],
    ["Đã hoàn", payment?.totalRefund ?? 0, <WalletOutlined />, "orange"],
    ["Tạm ứng", payment?.prepaid ?? 0, <MoneyCollectOutlined />, "blue"],
  ] as const;

  return (
    <section className="pd-pane pd-profile">
      <div className="pd-profile-card">
        <div className="pd-profile-column pd-profile-main">
          <div className="pd-profile-title">
            {/* Name, pencil and the record's tags share one wrapping row, as
                the reference does: a fourth chip drops to a second line rather
                than pushing the picker button off the card. */}
            <div className="pd-profile-name">
              <strong>
                ({patient.patientCode}) - {patient.fullName}
              </strong>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => setEditing(true)}
                aria-label={t("Chỉnh sửa hồ sơ")}
              />
              {tagsOnRecord.map((tag) => (
                <PatientTagChip key={tag.value} color={tag.color} label={tag.label} />
              ))}
            </div>
            <PatientTagPicker patient={patient} />
          </div>
          <div className="pd-info-grid">
            <InfoItem
              icon={<CalendarOutlined />}
              label={t("Ngày sinh")}
              value={`${formatDate(patient.dateOfBirth)}${ageOf(patient.dateOfBirth) === null ? "" : ` (${ageOf(patient.dateOfBirth)} ${t("tuổi")})`}`}
            />
            <InfoItem
              icon={<PhoneOutlined />}
              label={t("Số điện thoại")}
              value={patient.phoneNumber}
            />
            <InfoItem icon={<MailOutlined />} label={t("Email")} value={patient.email} />
            <InfoItem
              icon={<UserOutlined />}
              label={t("Giới tính")}
              value={t(genderLabels[patient.gender])}
            />
            <InfoItem icon={<IdcardOutlined />} label={t("CCCD")} value={patient.nationalId} />
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
              aria-label={t("Thêm lý do đến khám")}
              icon={<PlusOutlined />}
              onClick={() => setReasonOpen(true)}
            />
          </h3>
          {patient.examinationReasons.length === 0 ? (
            <p className="pd-reason-empty">{t("Chưa có lý do đến khám.")}</p>
          ) : (
            <div className="pd-reason-list">
              {patient.examinationReasons.map((reason) => (
                <div className="pd-reason" key={reason.id}>
                  <span className="pd-reason-date">{formatDate(reason.recordedAt)}</span>
                  <span className="pd-reason-text">{reason.content}</span>
                </div>
              ))}
            </div>
          )}
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
              <ReceptionSteps
                appointment={upcoming}
                onAdvanced={() => void appointmentsQuery.refetch()}
              />
              <AppointmentDoctorPicker
                appointment={upcoming}
                onChanged={() => void appointmentsQuery.refetch()}
              />
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
              <strong>{formatMoneyUnit(value)}</strong>
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
          /*
           * A row is one công đoạn, so the line id alone repeats across every
           * công đoạn of a line. The key stays *prefixed* by the line id — that
           * is how a row is addressed from outside — with the công đoạn making
           * it unique.
           */
          rowKey={(row) => `${row.id}:${row.stageId ?? row.recallCode ?? "none"}`}
          className="pd-treatment-table"
          columns={columns}
          dataSource={pageRows}
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
      <RecallDialog
        open={recallOpen}
        stages={finishedStages}
        onClose={() => setRecallOpen(false)}
        /*
         * The reference steps in place: Tái Khám swaps the listing for the
         * follow-up form and Đóng comes back to the rows, while Chi Tiết stacks
         * a read-only "Chi tiết dịch vụ" over them.
         */
        onBook={(stage) => {
          setRecallOpen(false);
          setRecallStageId(stage.id);
        }}
        onDetail={(stage) => setDetailStageId(stage.id)}
      />
      <StageFollowUpDialog
        open={recallStageId !== null}
        patientId={patient.id}
        branchId={branchId}
        plan={planOf(rows.find((row) => row.stageId === recallStageId) ?? null)}
        stage={finishedStages.find((item) => item.id === recallStageId) ?? null}
        kind="reExamination"
        onClose={() => {
          setRecallStageId(null);
          setRecallOpen(true);
        }}
      />
      <ServiceDetailDialog
        open={detailStageId !== null}
        patient={patient}
        plan={planOf(rows.find((row) => row.stageId === detailStageId) ?? null)}
        line={(() => {
          const row = rows.find((item) => item.stageId === detailStageId);
          const slip = planOf(row ?? null);
          return slip?.services.find((item) => item.id === row?.id) ?? null;
        })()}
        onClose={() => setDetailStageId(null)}
      />
      <PatientPaymentDialog
        open={paymentOpen}
        payments={account?.payments ?? []}
        total={account?.payment.totalPaid ?? 0}
        onClose={() => setPaymentOpen(false)}
      />
      <CreatePaymentDialog
        open={payingRow !== null}
        patientId={patient.id}
        branchId={branchId}
        plan={payingPlan}
        focusServiceId={payingRow?.id ?? null}
        heldForPatient={account?.heldForPatient ?? 0}
        onClose={() => setPayingRow(null)}
        onSaved={() => setPayingRow(null)}
      />
      <StageFollowUpDialog
        open={warrantyRow !== null}
        patientId={patient.id}
        branchId={branchId}
        plan={planOf(warrantyRow)}
        stage={
          (patientStages.data?.items ?? []).find((item) => item.id === warrantyRow?.stageId) ?? null
        }
        kind="guarantee"
        onClose={() => setWarrantyRow(null)}
      />
      <TreatmentStageDialog
        open={stageRow !== null}
        patientId={patient.id}
        patientCode={patient.patientCode}
        patientName={patient.fullName}
        branchId={branchId}
        plan={stagePlan}
        focusServiceId={stageRow?.id ?? null}
        onClose={() => setStageRow(null)}
        onOpenPlan={() => {
          /*
           * The reference leaves the dialog for **that slip's** detail screen,
           * not the tab listing every slip: measured 2026-09-07 as
           * /patient/:id/treatment-plan/:planId?planTab=detail&branchId=.
           */
          setStageRow(null);
          if (stagePlan) {
            navigate(planDetailPath(patient.id, stagePlan.id, branchId, PLAN_TAB.detail));
          }
        }}
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
