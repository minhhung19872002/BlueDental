import { useMemo } from "react";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { RESTORATION_MATERIAL_KIND, useRestorationMaterials } from "@/hooks/useRestorationMaterials";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { useMedicalRecordPhones, type MedicalRecordPhonesDto } from "../../../api/medicalRecordApi";
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
 * A phone as the bệnh án prints it: always whole, even for an account holding
 * "Ẩn số điện thoại" (clinic, 2026-10-21). The whole number comes from the
 * record's own phones endpoint; until it arrives, one the patient record
 * masked is left blank rather than printed masked.
 */
function wholePhone(
  phones: MedicalRecordPhonesDto | undefined,
  full: string | null | undefined,
  shown: string | null,
) {
  if (phones) return sheetPhone(full);
  return shown?.includes("*") ? undefined : sheetPhone(shown);
}

/**
 * The primary guardian as "Quan hệ - Họ tên - Số điện thoại" (clinic,
 * 2026-10-16) — the one ticked as primary contact, else the first listed. A
 * relation of "Khác" prints what the desk wrote beside it, when it wrote any.
 */
function guardianLine(
  guardians: readonly PatientGuardianDto[],
  phones: MedicalRecordPhonesDto | undefined,
): string | undefined {
  const guardian = guardians.find((item) => item.isPrimaryContact) ?? guardians[0];
  if (!guardian) return undefined;

  const relation =
    guardian.relation === GUARDIAN_RELATION.Other && guardian.relationNote?.trim()
      ? guardian.relationNote.trim()
      : t(RELATION_LABEL[guardian.relation]);
  const phone = wholePhone(phones, phones?.guardianPhones[guardian.id], guardian.phone);
  return [relation, guardian.fullName, phone]
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
 * out of the address table, looked up from their codes. The phones are read
 * whole (see `wholePhone`).
 */
export function useSheetFieldValues(patient: PatientDto | undefined, branchId: string): FieldValues {
  const phones = useMedicalRecordPhones(patient?.id).data;
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
        phone: wholePhone(phones, phones?.patientPhone, patient.phoneNumber),
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
        guardian: guardianLine(patient.guardians, phones),
        gender: GENDER_NAME[patient.gender],
      }),
      ...branchFieldValues(branch),
      ...catalogs,
    };
  }, [patient, phones, branch, occupations, diseases, address, materials]);
}
