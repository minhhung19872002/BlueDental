import {
  usePatientAdvises,
  usePatientDiagnoses,
} from "@/features/treatment-management/api/consultingQueries";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { TAXONOMY_GROUP, useCatalogEntries } from "@/features/taxonomy/api/taxonomyApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { adaptPatientImage } from "../api/patientImageAdapters";
import { usePatientImages } from "../api/patientImageApi";

/**
 * Everything Chẩn đoán & Tư vấn reads: the two paged lists, the doctor and diagnosis catalogues, the "Dữ liệu tư vấn" group and the
 * patient's photographs. The tab only renders what comes back.
 */
export function useConsultingData(patientId: string, branchId: string | null) {
  const diagnosisPaging = useTablePagination(20);
  const advisePaging = useTablePagination(20);
  const scope = { patientId, clinicBranchId: branchId ?? undefined };

  const diagnoses = usePatientDiagnoses({
    ...scope,
    skipCount: diagnosisPaging.skipCount,
    maxResultCount: diagnosisPaging.maxResultCount,
  });
  const advises = usePatientAdvises({
    ...scope,
    skipCount: advisePaging.skipCount,
    maxResultCount: advisePaging.maxResultCount,
  });
  const dentists = useDentistList().data ?? [];
  const diagnosisOptions = useCatalogOptions(CATALOG_GROUP.Diagnosis).data ?? [];
  // "Dữ liệu tư vấn" is a catalog group like any other, read through the same
  // endpoint the Danh mục screen uses.
  const consultingData =
    useCatalogEntries(branchId ?? undefined, TAXONOMY_GROUP.ConsultingData, {
      scope: "catalog",
      skipCount: 0,
      maxResultCount: 200,
    }).data?.items ?? [];
  const images = usePatientImages(patientId, branchId ?? "").data?.items ?? [];

  return {
    diagnoses,
    advises,
    diagnosisPaging,
    advisePaging,
    dentists: dentists.map((item) => ({ value: item.id, label: item.name })),
    dentistList: dentists,
    diagnosisOptions: diagnosisOptions.map((item) => ({ value: item.id, label: item.name })),
    consultingData,
    images: images.map(adaptPatientImage),
  };
}
