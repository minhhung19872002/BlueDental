import dayjs from "dayjs";
import type { Appointment } from "@/features/appointments/types/appointment";
import type { PatientListItem } from "@/features/patient-management/types/patient";
import { careStatusLabels, careTypeLabels, type CareRecordDto } from "@/features/cskh/api/careApi";
import type { StaffDto } from "@/features/staff/api/staffApi";
import { formatDate, formatDateTime } from "@/utils/format";
import { t } from "@/lib/i18n";

/** The palette's four groups, in the order they are listed (R-1053). */
export type SearchGroupKey = "patient" | "appointment" | "care" | "staff";

/** One line of the palette: what it says and where Enter or a click goes. */
export interface SearchRow {
  key: string;
  badge: string;
  name: string;
  meta: string;
  to: string;
}

export interface SearchGroup {
  key: SearchGroupKey;
  title: string;
  /** Every match the server counted; the palette lists the first few. */
  total: number;
  rows: SearchRow[];
}

/** A Lịch tạm nobody has made a hồ sơ for carries the empty id. */
const NO_PATIENT = "00000000-0000-0000-0000-000000000000";

const joinMeta = (parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" · ");

/**
 * "Huỳnh Văn Định (2002)" — the birth year tells same-name records apart
 * (owner 2026-10-27). `dateOfBirth` is "YYYY-MM-DD"; none recorded, name only.
 */
const withBirthYear = (fullName: string, dateOfBirth: string | null) =>
  dateOfBirth ? `${fullName} (${dateOfBirth.slice(0, 4)})` : fullName;

export const patientRow = (patient: PatientListItem): SearchRow => ({
  key: `patient:${patient.id}`,
  badge: t("Common:PatientBadge"),
  name: withBirthYear(patient.fullName, patient.dateOfBirth),
  meta: joinMeta([patient.patientCode, patient.phoneNumber, patient.serviceNames[0]]),
  to: `/patient/${patient.id}`,
});

/**
 * A booking opens on its patient's Lịch hẹn tab. A Lịch tạm with no hồ sơ yet,
 * or an account that may not open hồ sơ, lands on the calendar day instead.
 */
export const appointmentRow = (appointment: Appointment, canOpenPatient: boolean): SearchRow => {
  const hasPatient = canOpenPatient && appointment.patientId && appointment.patientId !== NO_PATIENT;
  return {
    key: `appointment:${appointment.id}`,
    badge: t("Common:AppointmentBadge"),
    name: appointment.patientName,
    meta: joinMeta([
      formatDateTime(appointment.startTime),
      appointment.doctorName,
      appointment.isTemporary ? t("Appointment:Status:Temporary") : appointment.statusLabel,
    ]),
    to: hasPatient
      ? `/patient/${appointment.patientId}?tab=appointment`
      : `/calendar?date=${dayjs(appointment.startTime).format("YYYY-MM-DD")}`,
  };
};

export const careRow = (record: CareRecordDto): SearchRow => ({
  key: `care:${record.id}`,
  badge: t("Common:CareBadge"),
  name: record.patientName ?? "",
  meta: joinMeta([
    careTypeLabels()[record.type],
    formatDate(record.dueAt ?? record.scheduledStart ?? record.creationTime),
    careStatusLabels()[record.status],
  ]),
  to: `/patient/${record.patientId}?tab=care`,
});

/** Opens Nhân sự with the name already in its search box. */
export const staffRow = (staff: StaffDto): SearchRow => ({
  key: `staff:${staff.id}`,
  badge: t("Common:StaffBadge"),
  name: staff.fullName,
  meta: joinMeta([staff.roleNames.join(", "), staff.phoneNumber]),
  to: `/staff?q=${encodeURIComponent(staff.fullName)}`,
});
