import { partialMatchKey, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { branchInfoKeys } from "@/hooks/useBranchInfo";
import { catalogOptionKeys } from "@/hooks/useCatalogOptions";
import { laboPickerKeys } from "@/hooks/useLaboPickers";
import { patientOptionKeys } from "@/hooks/usePatientOptions";
import { patientTagOptionKeys } from "@/hooks/usePatientTagOptions";
import { paymentAccountOptionKeys } from "@/hooks/usePaymentAccountOptions";
import { serviceGroupOptionKeys } from "@/hooks/useServiceGroupOptions";
import { staffOptionKeys } from "@/hooks/useStaffOptions";
import type { appointmentKeys } from "@/features/appointments/api/appointmentQueries";
import type { careKeys } from "@/features/cskh/api/careApi";
import type { laboMaterialKeys, laboSupplierKeys } from "@/features/labo/api/laboCatalogApi";
import type { laboCatalogKeys } from "@/features/labo/api/laboCatalogListApi";
import type { branchManagerKeys } from "@/features/organizations/api/branchManagerQueries";
import type { patientImageKeys } from "@/features/patient-management/api/patientImageApi";
import type { patientKeys } from "@/features/patient-management/api/patientQueries";
import type { clinicReportKeys } from "@/features/report/api/clinicReportApi";
import type { financeKeys } from "@/features/report/api/financeApi";
import type { staffKeys } from "@/features/staff/api/staffQueries";
import type { patientTagKeys } from "@/features/taxonomy/api/patientTagApi";
import type { paymentAccountKeys } from "@/features/taxonomy/api/paymentAccountApi";
import type { taxonomyKeys } from "@/features/taxonomy/api/taxonomyApi";
import type { consultingKeys } from "@/features/treatment-management/api/consultingQueries";
import type { stageKeys } from "@/features/treatment-management/api/stageApi";
import type { treatmentKeys } from "@/features/treatment-management/api/treatmentPlanApi";

/**
 * Which cached queries read which backend data.
 *
 * The client keeps data for five minutes, and one record is often read by
 * several screens under different keys. A write names the entities it changed
 * (`meta.invalidates`) and every reader listed here is invalidated, rather than
 * each writer remembering every other screen's key.
 *
 * Shared hooks' roots are imported. A feature's root is written out and checked
 * against its key factory at compile time only: a runtime import would pull
 * every feature's API into the entry chunk and loop back through the features
 * that import this file.
 */

/** A feature factory's `all`, so a key renamed there fails to compile here. */
type RootOf<Factory extends { all: QueryKey }> = Factory["all"];

const PATIENT_TREATMENTS = ["patient-treatments"] satisfies RootOf<typeof treatmentKeys>;
/** The patient list's rows carry a rollup of treatments, money and visits. */
const PATIENT_LISTS = ["patients", "list"] satisfies ReturnType<(typeof patientKeys)["lists"]>;
const CLINIC_REPORTS = ["clinic-reports"] satisfies RootOf<typeof clinicReportKeys>;
const LABO_CATALOG = ["labo-catalog"] satisfies RootOf<typeof laboCatalogKeys>;
const LABO_MATERIALS = ["labo-materials"] satisfies RootOf<typeof laboMaterialKeys>;
const CURRENT_USER = ["auth", "current-user"];

export const ENTITY_QUERY_ROOTS = {
  catalog: [
    ["taxonomy"] satisfies RootOf<typeof taxonomyKeys>,
    catalogOptionKeys.all,
    serviceGroupOptionKeys.all,
  ],
  paymentAccount: [
    ["payment-accounts"] satisfies RootOf<typeof paymentAccountKeys>,
    paymentAccountOptionKeys.all,
  ],
  patientTag: [
    ["patient-tags"] satisfies RootOf<typeof patientTagKeys>,
    patientTagOptionKeys.all,
  ],
  patient: [["patients"] satisfies RootOf<typeof patientKeys>, patientOptionKeys.all],
  appointment: [
    ["appointments"] satisfies RootOf<typeof appointmentKeys>,
    // Tiếp nhận reads the same appointments under keys of its own.
    ["receptions"],
    ["receptionMetrics"],
    // Next appointment and last visit.
    PATIENT_LISTS,
  ],
  treatment: [
    PATIENT_TREATMENTS,
    ["treatment-stages"] satisfies RootOf<typeof stageKeys>,
    ["consulting"] satisfies RootOf<typeof consultingKeys>,
    PATIENT_LISTS,
    // Báo cáo lists the service lines themselves.
    CLINIC_REPORTS,
  ],
  treatmentStage: [
    ["treatment-stages"] satisfies RootOf<typeof stageKeys>,
    // The treatment table reads a line's stage count and note off the slip.
    PATIENT_TREATMENTS,
    PATIENT_LISTS,
  ],
  payment: [
    PATIENT_TREATMENTS,
    PATIENT_LISTS,
    // Also the dashboard's revenue bars.
    CLINIC_REPORTS,
    ["finance"] satisfies RootOf<typeof financeKeys>,
    ["care-records"] satisfies RootOf<typeof careKeys>,
  ],
  laboOrder: [
    ["labo-orders"],
    // The slip counts a line's open orders, which gates Chuyển đổi dịch vụ.
    PATIENT_TREATMENTS,
    // Pictures sent with an order are filed into Hình ảnh.
    ["patient-images"] satisfies RootOf<typeof patientImageKeys>,
  ],
  laboSupplier: [
    ["labo-suppliers"] satisfies RootOf<typeof laboSupplierKeys>,
    laboPickerKeys.suppliers,
  ],
  laboMaterial: [
    LABO_MATERIALS,
    // Each group shows how many materials it holds.
    LABO_CATALOG,
    laboPickerKeys.materials,
  ],
  laboTaxonomy: [
    LABO_CATALOG,
    laboPickerKeys.taxonomies,
    // Materials are listed and picked under their group's name.
    LABO_MATERIALS,
    laboPickerKeys.materials,
  ],
  staff: [
    ["staff"] satisfies RootOf<typeof staffKeys>,
    staffOptionKeys.all,
    ["receptionDoctors"],
    // Staff are identity users; managers and the signed-in account are staff.
    ["identity-users"],
    ["branch-managers"] satisfies RootOf<typeof branchManagerKeys>,
    ["my-profile"],
    // Its roles, and so its permissions, may be the ones that changed.
    CURRENT_USER,
  ],
  role: [["identity-roles"], ["role-permissions"], CURRENT_USER],
  branch: [["clinic-branches"], branchInfoKeys.all, ["clinic-info"]],
} as const satisfies Record<string, readonly QueryKey[]>;

export type QueryEntity = keyof typeof ENTITY_QUERY_ROOTS;

/** Invalidates every cached query that reads one of `entities`. */
export function invalidateEntities(
  queryClient: QueryClient,
  entities: readonly QueryEntity[],
): void {
  if (entities.length === 0) return;

  const roots = entities.flatMap((entity): readonly QueryKey[] => ENTITY_QUERY_ROOTS[entity]);
  // One pass, so a query two entities share is refetched once rather than
  // started, cancelled and started again.
  void queryClient.invalidateQueries({
    predicate: (query) => roots.some((root) => partialMatchKey(query.queryKey, root)),
  });
}

/** What a mutation may declare about itself; read by the MutationCache in `queryClient.ts`. */
export type AppMutationMeta = {
  /** The entities this write changes; their readers are invalidated once it succeeds. */
  invalidates?: readonly QueryEntity[];
  /** The mutation reports its own failure, so the global error toast stays quiet. */
  skipGlobalErrorToast?: boolean;
};

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: AppMutationMeta;
  }
}
