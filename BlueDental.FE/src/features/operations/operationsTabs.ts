import { t } from "@/lib/i18n";

/**
 * The eight divisions the reference lists across the top, in its order, and
 * what each one holds.
 *
 * Three facts here are the reference's, not conveniences:
 *
 * 1. **The sub-tabs differ per division.** Only Quản trị vận hành offers all
 *    six; most offer three or four, and Khối tài chính offers a different six.
 * 2. **Each division has its own sub-tab parameter** (`overviewSubTab`,
 *    `assistantSubTab`, …), and they all persist in the URL together, so
 *    leaving a division and coming back returns to the sub-tab it was left on.
 * 3. **Only Trang chủ, Quy trình and Công việc are the category+article
 *    screen.** Every other sub-tab is a report with its own columns and no
 *    category panel — see `kind`.
 *
 * Khối điều trị and Khối tài chính add a tab row between the two: Tổng quan
 * holds the sub-tabs above, Truy cập is a revenue report of its own.
 */
export type OperationsSubTabKind = "articles" | "report";

export interface OperationsSubTab {
  key: string;
  label: string;
  kind: OperationsSubTabKind;
}

export interface OperationsMiddleTab {
  key: string;
  label: string;
}

export interface OperationsDivision {
  key: string;
  label: string;
  subTabs: OperationsSubTab[];
  /** Present only on the two divisions the reference gives a middle tab row. */
  middleTabs?: OperationsMiddleTab[];
}

/** `?overviewSubTab=`, `?financeSubTab=`, … — one per division. */
export function subTabParamOf(division: OperationsDivision): string {
  return `${division.key}SubTab`;
}

/** `?treatmentTab=`, `?financeTab=` — the middle row, where there is one. */
export function middleTabParamOf(division: OperationsDivision): string {
  return `${division.key}Tab`;
}

const articles = (key: string, label: string): OperationsSubTab => ({
  key,
  label,
  kind: "articles",
});

const report = (key: string, label: string): OperationsSubTab => ({
  key,
  label,
  kind: "report",
});

/** The three every division has, in the reference's order. */
function articleSubTabs(): OperationsSubTab[] {
  return [
    articles("home", t("Operations:Home")),
    articles("process", t("Operations:Process")),
    articles("task", t("Operations:Task")),
  ];
}

function withReport(): OperationsSubTab[] {
  return [...articleSubTabs(), report("report", t("Operations:Report"))];
}

/** Tổng quan / Truy cập, on the two divisions that have it. */
function middleTabs(): OperationsMiddleTab[] {
  return [
    { key: "overview", label: t("Operations:Overview") },
    { key: "access", label: t("Operations:Access") },
  ];
}

export function operationsDivisions(): OperationsDivision[] {
  return [
    {
      key: "overview",
      label: t("Operations:Admin"),
      subTabs: [
        ...withReport(),
        report("untreated", t("Operations:UntreatedDiagnosis")),
        report("prescription", t("Operations:Prescription")),
      ],
    },
    { key: "assistant", label: t("Operations:AssistantBlock"), subTabs: articleSubTabs() },
    { key: "reception", label: t("Operations:ReceptionBlock"), subTabs: withReport() },
    { key: "cskh", label: t("Operations:CSKHBlock"), subTabs: withReport() },
    { key: "marketing", label: t("Operations:MarketingBlock"), subTabs: withReport() },
    { key: "security", label: t("Operations:SecurityBlock"), subTabs: articleSubTabs() },
    {
      key: "treatment",
      label: t("Operations:TreatmentBlock"),
      middleTabs: middleTabs(),
      subTabs: withReport(),
    },
    {
      key: "finance",
      label: t("Operations:FinanceBlock"),
      middleTabs: middleTabs(),
      // Its own six, in the reference's order — not the shared set.
      subTabs: [
        articles("home", t("Operations:Home")),
        report("customer-report", t("Operations:CustomerReport")),
        articles("process", t("Operations:Process")),
        articles("task", t("Operations:Task")),
        report("invoice", t("Operations:Invoice")),
        report("service-complete", t("Operations:ServiceComplete")),
      ],
    },
  ];
}

export const DEFAULT_DIVISION = "overview";
export const DEFAULT_SUB_TAB = "home";
export const DEFAULT_MIDDLE_TAB = "overview";

/**
 * Maps a sub-tab key to the suffix the BE uses in its ability subject name.
 * `operationsTabs.ts` uses kebab-case keys; the BE uses PascalCase suffixes.
 */
const SUB_TAB_SUFFIX: Record<string, string> = {
  home: "Home",
  process: "Process",
  task: "Task",
  report: "Report",
  untreated: "Diagnosis",
  prescription: "Prescription",
  "customer-report": "Report",
  invoice: "Invoice",
  "service-complete": "ServiceComplete",
};

const DIVISION_PREFIX: Record<string, string> = {
  overview: "operationsOverview",
  assistant: "operationsAssistant",
  reception: "operationsReception",
  cskh: "operationsCskh",
  marketing: "operationsMarketing",
  security: "operationsSecurity",
  treatment: "operationsTreatment",
  finance: "operationsFinance",
};

/**
 * Returns the BE ability subject for a given (division, subTab) pair, e.g.
 * `("overview", "report")` → `"operationsOverviewReport"`.
 * Falls back to `"operationsOverviewHome"` for unknown combinations.
 */
export function abilitySubjectFor(divisionKey: string, subTabKey: string): string {
  const prefix = DIVISION_PREFIX[divisionKey] ?? "operationsOverview";
  const suffix = SUB_TAB_SUFFIX[subTabKey] ?? "Home";
  return `${prefix}${suffix}`;
}

/**
 * Returns the BE ability subject for the middle tab "Truy cập" screen.
 * `("treatment", "access")` → `"operationsTreatmentAccess"`.
 */
export function abilitySubjectForMiddle(divisionKey: string, middleKey: string): string {
  const prefix = DIVISION_PREFIX[divisionKey] ?? "operationsOverview";
  const suffix = middleKey === "access" ? "Access" : "Home";
  return `${prefix}${suffix}`;
}

export function findDivision(key: string | undefined): OperationsDivision {
  const all = operationsDivisions();
  return all.find((d) => d.key === key) ?? all[0];
}
