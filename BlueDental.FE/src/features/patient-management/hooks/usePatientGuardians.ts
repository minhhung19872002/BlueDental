import { useCallback, useState } from "react";
import {
  EMPTY_GUARDIAN_GROUP,
  guardianFromDto,
  guardianToInput,
  type GuardianGroup,
} from "../utils/guardian";
import type { PatientDto, PatientGuardianInput } from "../types/patient";

/** Which guardian the popup opens on: a new blank one, or one already in the group. */
export type GuardianPopupFocus = { kind: "new" } | { kind: "existing"; index: number };

/**
 * The hồ sơ dialog's guardian group: what the cards show, what the popup edits
 * a copy of, and what the dialog's own Lưu sends. Nothing reaches the server
 * until that Lưu — "Lưu & quay lại hồ sơ" only hands the popup's copy back.
 */
export function usePatientGuardians() {
  const [group, setGroup] = useState<GuardianGroup>(EMPTY_GUARDIAN_GROUP);
  const [popupFocus, setPopupFocus] = useState<GuardianPopupFocus | null>(null);

  const reset = useCallback((patient: PatientDto | null) => {
    const guardians = (patient?.guardians ?? []).map(guardianFromDto);
    // A group on file was consented to when it was saved.
    setGroup({ guardians, consented: guardians.length > 0 });
    setPopupFocus(null);
  }, []);

  const openNew = useCallback(() => setPopupFocus({ kind: "new" }), []);
  const openExisting = useCallback((index: number) => setPopupFocus({ kind: "existing", index }), []);
  const closePopup = useCallback(() => setPopupFocus(null), []);

  const commitPopup = useCallback((next: GuardianGroup) => {
    setGroup(next);
    setPopupFocus(null);
  }, []);

  /** The card's delete. The first one left takes over as the primary contact. */
  const remove = useCallback((index: number) => {
    setGroup((current) => {
      const guardians = current.guardians.filter((_, i) => i !== index);
      if (guardians.length > 0 && !guardians.some((g) => g.isPrimaryContact)) {
        guardians[0] = { ...guardians[0], isPrimaryContact: true };
      }
      return { guardians, consented: guardians.length > 0 && current.consented };
    });
  }, []);

  const toPayload = useCallback(
    (): { guardians: PatientGuardianInput[]; guardiansConsented: boolean } => ({
      guardians: group.guardians.map(guardianToInput),
      guardiansConsented: group.consented,
    }),
    [group],
  );

  return { group, popupFocus, reset, openNew, openExisting, closePopup, commitPopup, remove, toPayload };
}
