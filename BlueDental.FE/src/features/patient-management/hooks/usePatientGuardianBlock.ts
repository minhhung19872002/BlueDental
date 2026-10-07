import { useMemo, useState } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { GENDER_BY_CODE } from "../api/patientAdapters";
import { useUpdatePatientGuardians } from "../api/patientMutations";
import type { PatientDto } from "../types/patient";
import {
  ageByYear,
  guardianFromDto,
  guardianToInput,
  requiresGuardian,
  type GuardianDraft,
  type GuardianGroup,
} from "../utils/guardian";
import type { GuardianPopupFocus } from "./usePatientGuardians";

/** Exactly one primary contact survives a delete: the first one left takes it. */
function withoutGuardian(guardians: GuardianDraft[], index: number): GuardianDraft[] {
  const left = guardians.filter((_, i) => i !== index);
  if (left.length > 0 && !left.some((g) => g.isPrimaryContact)) {
    left[0] = { ...left[0], isPrimaryContact: true };
  }
  return left;
}

/**
 * The "Người giám hộ" block on the record's Hồ sơ tab. Unlike the hồ sơ
 * dialog, whose group waits for its own Lưu, every add, edit and delete here
 * is written straight away through `PUT /patients/{id}/guardians`.
 */
export function usePatientGuardianBlock(patient: PatientDto) {
  const mutation = useUpdatePatientGuardians(patient.id);
  const [focus, setFocus] = useState<GuardianPopupFocus | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

  // The drafts are rebuilt only when the record itself changes, so the
  // popup's seeding effect does not reset the form under the user.
  const group = useMemo<GuardianGroup>(() => {
    const guardians = (patient.guardians ?? []).map(guardianFromDto);
    return { guardians, consented: guardians.length > 0 };
  }, [patient.guardians]);

  const summary = useMemo(() => {
    const dateOfBirth = patient.dateOfBirth ? dayjs(patient.dateOfBirth) : null;
    const age = ageByYear(dateOfBirth);
    return {
      fullName: patient.fullName,
      code: patient.patientCode,
      gender: GENDER_BY_CODE[patient.gender],
      dateOfBirth,
      age,
      required: requiresGuardian(age),
    };
  }, [patient.dateOfBirth, patient.fullName, patient.patientCode, patient.gender]);

  /*
   * `mutate`, not `mutateAsync`: a refusal (Patient:0013, a duplicate CCCD…)
   * is toasted by the global MutationCache and leaves the popup or the confirm
   * open, so nothing here has to catch it.
   */
  const write = (guardians: GuardianDraft[], consented: boolean, onDone: () => void) =>
    mutation.mutate(
      { guardians: guardians.map(guardianToInput), guardiansConsented: guardians.length > 0 && consented },
      { onSuccess: onDone },
    );

  /** "Lưu & quay lại hồ sơ". */
  const save = (next: GuardianGroup) =>
    write(next.guardians, next.consented, () => {
      toast.success(t("Patient:Guardian:Saved"));
      setFocus(null);
    });

  const confirmDelete = () => {
    if (deletingIndex === null) return;
    write(withoutGuardian(group.guardians, deletingIndex), group.consented, () => {
      toast.success(t("Patient:Guardian:Deleted"));
      setDeletingIndex(null);
    });
  };

  return {
    group,
    summary,
    focus,
    openNew: () => setFocus({ kind: "new" }),
    openExisting: (index: number) => setFocus({ kind: "existing", index }),
    closePopup: () => setFocus(null),
    save,
    deleting: deletingIndex === null ? null : group.guardians[deletingIndex] ?? null,
    askDelete: setDeletingIndex,
    cancelDelete: () => setDeletingIndex(null),
    confirmDelete,
    pending: mutation.isPending,
  };
}
