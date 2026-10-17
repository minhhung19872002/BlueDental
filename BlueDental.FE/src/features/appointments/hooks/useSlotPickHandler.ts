import { useCallback } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { t } from "@/lib/i18n";
import type { MiniCalSlotPick, PickedDoctor } from "../types/slotPick";

type PickField = "date" | "startTime" | "doctorId";

interface Args {
  /** The form's current "Ngày hẹn"; `doctorOptions` are the doctors bookable on it. */
  formDate: string;
  doctorOptions: { value: string }[];
  set: (field: PickField, value: string) => void;
}

type DoctorVerdict = "take" | "inactive" | "dayOff";

/**
 * Whether the form can take the row's doctor. The booking picker leaves out
 * the doctors who are OFF that day on Chấm công and those no longer active as
 * doctors; the second are told apart by the plain list of active doctors.
 * A pick on another day than the form's is checked against that day's list
 * by useBookableDoctorOptions, which names an OFF day itself.
 */
function judgeDoctor(
  doctor: PickedDoctor,
  sameDay: boolean,
  doctorOptions: { value: string }[],
  activeIds: Set<string> | null,
): DoctorVerdict {
  if (sameDay && doctorOptions.some((option) => option.value === doctor.id)) return "take";
  if (activeIds && !activeIds.has(doctor.id)) return "inactive";
  return sameDay ? "dayOff" : "take";
}

/**
 * Fills Ngày hẹn / Giờ hẹn from a slot clicked in "Lịch đã hẹn" and, on a
 * doctor's row, Chọn bác sĩ (BA 2026-10-17). A doctor the form cannot take is
 * left out with a warning that says why; the time is still taken.
 */
export function useSlotPickHandler({ formDate, doctorOptions, set }: Args) {
  const { data: activeDentists } = useDentistList();

  return useCallback(
    (pick: MiniCalSlotPick) => {
      set("date", pick.date);
      set("startTime", pick.time);
      const { doctor } = pick;
      if (!doctor) return;
      const activeIds = activeDentists ? new Set(activeDentists.map((d) => d.id)) : null;
      const verdict = judgeDoctor(doctor, pick.date === formDate, doctorOptions, activeIds);
      if (verdict === "take") {
        set("doctorId", doctor.id);
      } else if (verdict === "dayOff") {
        toast.warning(t("Appointment:MiniCal:DoctorDayOff", doctor.name, dayjs(pick.date).format("DD/MM/YYYY")));
      } else {
        toast.warning(t("Appointment:MiniCal:DoctorInactive", doctor.name));
      }
    },
    [activeDentists, doctorOptions, formDate, set],
  );
}
