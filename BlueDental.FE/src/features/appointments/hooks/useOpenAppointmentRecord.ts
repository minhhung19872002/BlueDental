import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePatientLinkTab } from "@/hooks/usePatientLinkTab";
import type { AppointmentDto } from "../types/appointment";

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

type RecordSource = Pick<AppointmentDto, "id" | "patientId" | "patientName" | "patientPhone" | "isTemporary">;

/**
 * A booking clicked on Lịch hẹn opens its patient, as a card on Tiếp nhận
 * does (BA 2026-11-05): the record on the viewer's usual tab, or — for a
 * "Lịch tạm", even a cancelled one — "Tạo hồ sơ" with the walk-in filled in.
 */
export function useOpenAppointmentRecord() {
  const navigate = useNavigate();
  const patientTab = usePatientLinkTab();
  const [temporaryTarget, setTemporaryTarget] = useState<RecordSource | null>(null);

  const openRecord = useCallback((appointment: RecordSource) => {
    if (appointment.isTemporary) {
      setTemporaryTarget(appointment);
      return;
    }
    if (appointment.patientId && appointment.patientId !== EMPTY_GUID) {
      navigate(`/patient/${appointment.patientId}?tab=${patientTab}`);
    }
  }, [navigate, patientTab]);

  const closeTemporary = useCallback(() => setTemporaryTarget(null), []);

  return { openRecord, temporaryTarget, closeTemporary };
}
