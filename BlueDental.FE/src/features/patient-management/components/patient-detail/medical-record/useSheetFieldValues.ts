import { useMemo } from "react";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { RESTORATION_MATERIAL_KIND, useRestorationMaterials } from "@/hooks/useRestorationMaterials";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { useAddressParts } from "../../../hooks/useGuardianSubject";
import { GENDER, GUARDIAN_RELATION, type PatientDto, type PatientGuardianDto } from "../../../types/patient";
import { RELATION_LABEL } from "../../../utils/guardian";
import { branchFieldValues, patientFieldValues, sheetPhone, type FieldValues } from "./fieldValues";
import { materialCatalogKey, type SheetMaterial } from "./materials/materialField";

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
 * The primary guardian as "Quan hệ - Họ tên - Số điện thoại" (clinic,
 * 2026-10-16) — the one ticked as primary contact, else the first listed. A
 * relation of "Khác" prints what the desk wrote beside it, when it wrote any.
 */
function guardianLine(guardians: readonly PatientGuardianDto[]): string | undefined {
  const guardian = guardians.find((item) => item.isPrimaryContact) ?? guardians[0];
  if (!guardian) return undefined;

  const relation =
    guardian.relation === GUARDIAN_RELATION.Other && guardian.relationNote?.trim()
      ? guardian.relationNote.trim()
      : t(RELATION_LABEL[guardian.relation]);
  return [relation, guardian.fullName, sheetPhone(guardian.phone)]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" - ");
}

/**
 * What the blanks on a record are answered with when nobody has written on
 * them: the patient's own facts and the branch letterhead.
 *
 * Occupation and disease history are names out of Danh mục, so they arrive with
 * their catalogs rather than with the patient; the ward and province are names
 * out of the address table, looked up from their codes.
 */
export function useSheetFieldValues(patient: PatientDto | undefined, branchId: string): FieldValues {
  const branch = useBranchInfo(branchId).data;
  const occupations = useCatalogOptions(CATALOG_GROUP.Occupation).data;
  const diseases = useCatalogOptions(CATALOG_GROUP.DiseaseHistory).data;
  const address = useAddressParts(patient?.address, patient?.provinceCode, patient?.wardCode);
  const materials = useRestorationMaterials().data;

  return useMemo(() => {
    // "Loại" on mẫu 5: the crown and implant types of Danh mục, per kind.
    const catalogs: FieldValues = {};
    for (const kind of Object.values(RESTORATION_MATERIAL_KIND)) {
      const list: SheetMaterial[] = (materials ?? [])
        .filter((item) => item.kind === kind)
        .map(({ id, name, brand, origin, warranty }) => ({ id, name, brand, origin, warranty }));
      catalogs[materialCatalogKey(kind)] = JSON.stringify(list);
    }

    if (!patient) return { ...branchFieldValues(branch), ...catalogs };

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
        phone: sheetPhone(patient.phoneNumber),
        cccd: patient.nationalId ?? undefined,
        email: patient.email ?? undefined,
        address: address.full,
        addressStreet: address.street,
        ward: address.ward,
        province: address.province,
        job,
        reason: reason || undefined,
        history: history || undefined,
        note: patient.note ?? undefined,
        insuranceNumber: patient.insuranceNumber ?? undefined,
        guardian: guardianLine(patient.guardians),
        gender: GENDER_NAME[patient.gender],
      }),
      ...branchFieldValues(branch),
      ...catalogs,
    };
  }, [patient, branch, occupations, diseases, address, materials]);
}
