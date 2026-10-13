import { useCallback, useState } from "react";

/**
 * The board's two doctor filters, one at a time: picking a Nhóm bác sĩ clears
 * the doctors picked one by one, and picking a doctor clears the team — the
 * board never shows the overlap of the two.
 */
export function useDoctorFilter() {
  const [doctorIds, setDoctorIds] = useState<string[]>([]);
  const [teamId, setTeamId] = useState<string | undefined>();

  const selectDoctors = useCallback((ids: string[]) => {
    setDoctorIds(ids);
    if (ids.length > 0) setTeamId(undefined);
  }, []);

  const selectTeam = useCallback((id: string | undefined) => {
    setTeamId(id);
    if (id) setDoctorIds([]);
  }, []);

  /** Puts back both picks at once, as the mobile filter's Áp dụng does. */
  const reset = useCallback((next: { doctorIds: string[]; teamId?: string }) => {
    setDoctorIds(next.doctorIds);
    setTeamId(next.teamId);
  }, []);

  return { doctorIds, teamId, selectDoctors, selectTeam, reset };
}

export type DoctorFilter = ReturnType<typeof useDoctorFilter>;
