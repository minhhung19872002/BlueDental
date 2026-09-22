import { useMemo } from "react";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { formatDate } from "@/utils/format";
import { GENDER, type PatientDto } from "../../../types/patient";
import { branchFieldValues, patientFieldValues, type FieldValues } from "./fieldValues";

/** The three the forms know about; anything else prints nothing. */
const GENDER_NAME: Record<number, string> = {
  [GENDER.Male]: "male",
  [GENDER.Female]: "female",
  [GENDER.Other]: "other",
};

function ageOf(dateOfBirth: string | null): string | undefined {
  if (!dateOfBirth) return undefined;
  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return undefined;

  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const months = now.getMonth() - born.getMonth();
  if (months < 0 || (months === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? String(age) : undefined;
}

/**
 * What the blanks on a record are answered with when nobody has written on
 * them: the patient's own facts and the branch letterhead.
 *
 * Occupation and disease history are names out of Danh mục, so they arrive with
 * their catalogs rather than with the patient.
 */
export function useSheetFieldValues(patient: PatientDto | undefined, branchId: string): FieldValues {
  const branch = useBranchInfo(branchId).data;
  const occupations = useCatalogOptions(CATALOG_GROUP.Occupation).data;
  const diseases = useCatalogOptions(CATALOG_GROUP.DiseaseHistory).data;

  return useMemo(() => {
    if (!patient) return branchFieldValues(branch);

    const job =
      occupations?.find((item) => item.id === patient.occupationEntryId)?.name ??
      patient.occupationOther ??
      undefined;

    const history = diseases
      ?.filter((item) => patient.diseaseHistoryEntryIds.includes(item.id))
      .map((item) => item.name)
      .join(", ");

    const reason = patient.examinationReasons
      .map((line) => line.content?.trim() || line.note?.trim())
      .filter(Boolean)
      .join(", ");

    return {
      ...patientFieldValues({
        code: patient.patientCode,
        name: patient.fullName,
        dateOfBirth: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : undefined,
        age: ageOf(patient.dateOfBirth),
        phone: patient.phoneNumber ?? undefined,
        cccd: patient.nationalId ?? undefined,
        email: patient.email ?? undefined,
        job,
        reason: reason || undefined,
        history: history || undefined,
        note: patient.note ?? undefined,
        insuranceNumber: patient.insuranceNumber ?? undefined,
        gender: GENDER_NAME[patient.gender],
      }),
      ...branchFieldValues(branch),
    };
  }, [patient, branch, occupations, diseases]);
}
