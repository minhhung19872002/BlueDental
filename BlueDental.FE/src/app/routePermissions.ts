/**
 * Which permission opens which screen.
 *
 * Each list is "any of": holding one of the permissions is enough to see the
 * menu entry and to open the route. The names are the ones the server grants
 * (`BlueDental.<subject>.<action>` for the CASL-style tree the Phân quyền tab
 * edits, and the older `BlueDental.<Area>.<Verb>` names the admin-only
 * screens still use).
 *
 * An empty list means every signed-in user may open the screen — Tổng quan is
 * the one such screen, by the owner's decision (2026-09-22).
 */

import { abilityPermission, LegacyPermissions, AbpPermissions } from "@/lib/permissionConstants";

const OPERATIONS_DEPARTMENTS = [
  "Overview",
  "Assistant",
  "Reception",
  "Cskh",
  "Marketing",
  "Security",
  "Treatment",
  "Finance",
] as const;

const OPERATIONS_SECTIONS = ["Home", "Process", "Task"] as const;

/**
 * Additional operations ability subjects beyond Department×Section.
 * These cover report, access, and specialty sub-tabs that each division defines.
 */
const OPERATIONS_EXTRA_SUBJECTS = [
  "operationsCskhReport",
  "operationsFinanceAccess",
  "operationsFinanceInvoice",
  "operationsFinanceServiceComplete",
  "operationsMarketingReport",
  "operationsOverviewDiagnosis",
  "operationsOverviewPrescription",
  "operationsOverviewReport",
  "operationsReceptionReport",
  "operationsTreatmentAccess",
  "operationsTreatmentReport",
] as const;

const CATALOG_SUBJECTS = [
  "catalogService",
  "catalogDiagnosis",
  "catalogMedicine",
  "catalogConsultation",
  "catalogSource",
  "catalogHistory",
  "catalogOccupation",
  "catalogPrescription",
  "catalogTemplate",
  "catalogRecordTag",
  "catalogPaymentMethod",
  "catalogPost",
] as const;

function readOf(subjects: readonly string[]): readonly string[] {
  return subjects.map((subject) => abilityPermission(subject, "read"));
}

export const ROUTE_PERMISSIONS = {
  dashboard: [] as readonly string[],
  reception: readOf(["reception"]),
  calendar: readOf(["appointment", "workSchedule"]),
  patients: readOf(["patient"]),
  cskh: readOf(["cskhGroup", "cskhCare"]),
  billing: readOf(["payment"]),
  voucher: readOf(["voucher"]),
  reports: readOf([
    "reportSales",
    "reportIncome",
    "reportCost",
    "reportResult",
    "reportTransfer",
  ]),
  materials: readOf(["materials"]),
  labo: readOf([
    "laboTemplate",
    "laboSupplier",
    "laboBite",
    "laboFinishLine",
    "laboRhythm",
    "laboMaterial",
    "treatmentLabo",
  ]),
  staff: readOf(["staff"]),
  operations: readOf([
    ...OPERATIONS_DEPARTMENTS.flatMap((department) =>
      OPERATIONS_SECTIONS.map((section) => `operations${department}${section}`),
    ),
    ...OPERATIONS_EXTRA_SUBJECTS,
  ]),
  tools: readOf(["toolCall", "toolMessage"]),
  queue: readOf(["queue"]),
  taxonomy: readOf(CATALOG_SUBJECTS),
  /* The settings page gates its own tabs — see ClinicSettingsPage. */
  /* Admin-only screens that still carry the older permission names. */
  identity: [
    AbpPermissions.Identity.Users,
    AbpPermissions.Identity.Roles,
    LegacyPermissions.SystemAdmin.Users,
    LegacyPermissions.SystemAdmin.Roles,
  ] as readonly string[],
  auditLogs: [LegacyPermissions.SystemAdmin.AuditLogs] as readonly string[],
  organizations: [LegacyPermissions.Organizations.View] as readonly string[],
} as const satisfies Record<string, readonly string[]>;

export type RoutePermissionKey = keyof typeof ROUTE_PERMISSIONS;
