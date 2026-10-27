import { useMemo } from "react";
import dayjs from "dayjs";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useAppointmentList } from "@/features/appointments/api/appointmentQueries";
import { useCareRecordList } from "@/features/cskh/api/careApi";
import { useStaffList } from "@/features/staff/api/staffQueries";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useAbility } from "@/hooks/useAbility";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { LegacyPermissions } from "@/lib/permissionConstants";
import { t } from "@/lib/i18n";
import {
  appointmentRow,
  careRow,
  patientRow,
  staffRow,
  type SearchGroup,
} from "@/utils/globalSearchRows";

/** Below this the server would be asked to match half the clinic. */
export const MIN_QUERY = 2;

/** Rows listed per group; the header carries the full count. */
const GROUP_SIZE = 5;

/** Each group asks the endpoint its own screen uses, so the server's checks apply. */
function useSearchPermissions() {
  const canReadPatient = useAbility("patient").canRead;
  const canReadAppointment = useAbility("appointment").canRead;
  const canOpenStaff = useAbility("staff").canRead;
  const canViewCare = useAuthStore((s) => s.user?.permissions.includes(LegacyPermissions.CustomerCare.View) ?? false);
  const canViewStaff = useAuthStore((s) => s.user?.permissions.includes(LegacyPermissions.Staff.View) ?? false);
  return useMemo(
    () => ({
      patient: canReadPatient,
      appointment: canReadAppointment,
      // A CSKH row opens the patient's record, so it needs that too.
      care: canViewCare && canReadPatient,
      staff: canViewStaff && canOpenStaff,
      openPatient: canReadPatient,
    }),
    [canReadPatient, canReadAppointment, canViewCare, canViewStaff, canOpenStaff],
  );
}

/**
 * The Ctrl-K palette's four searches (R-1053): Bệnh nhân, Lịch hẹn (from today
 * on, the customer only), CSKH and Nhân viên, all in the current branch and all
 * accent-blind on the server. A group the account may not read is never asked.
 */
export function useGlobalSearch(term: string) {
  const allowed = useSearchPermissions();
  const branchId = useCurrentBranchId();
  const filter = term.trim();
  const enabled = filter.length >= MIN_QUERY;
  const page = { maxResultCount: GROUP_SIZE };
  const today = dayjs().format("YYYY-MM-DD");

  const patients = usePatientList({ filter, ...page }, enabled && allowed.patient);
  const appointments = useAppointmentList(
    { patientFilter: filter, fromDate: today, ...page },
    enabled && allowed.appointment,
  );
  const care = useCareRecordList({ filter, branchId, ...page }, enabled && allowed.care);
  const staff = useStaffList({ filter, branchId, ...page }, enabled && allowed.staff);

  const groups = useMemo((): SearchGroup[] => {
    if (!enabled) return [];
    const all: SearchGroup[] = [
      {
        key: "patient",
        title: t("Common:Patient"),
        total: patients.data?.totalCount ?? 0,
        rows: (patients.data?.items ?? []).map(patientRow),
      },
      {
        key: "appointment",
        title: t("Common:Appointment"),
        total: appointments.data?.totalCount ?? 0,
        rows: (appointments.data?.items ?? []).map((a) => appointmentRow(a, allowed.openPatient)),
      },
      {
        key: "care",
        title: t("Common:CSKH"),
        total: care.data?.totalCount ?? 0,
        rows: (care.data?.items ?? []).map(careRow),
      },
      {
        key: "staff",
        title: t("Common:Staff"),
        total: staff.data?.totalCount ?? 0,
        rows: (staff.data?.items ?? []).map(staffRow),
      },
    ];
    return all.filter((group) => allowed[group.key] && group.rows.length > 0);
  }, [enabled, allowed, patients.data, appointments.data, care.data, staff.data]);

  const isFetching = [patients, appointments, care, staff].some((query) => query.isFetching);
  return { enabled, groups, isFetching };
}
