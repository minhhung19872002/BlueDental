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
    articles("home", t("Trang chủ")),
    articles("process", t("Quy trình")),
    articles("task", t("Công việc")),
  ];
}

function withReport(): OperationsSubTab[] {
  return [...articleSubTabs(), report("report", t("Báo cáo"))];
}

/** Tổng quan / Truy cập, on the two divisions that have it. */
function middleTabs(): OperationsMiddleTab[] {
  return [
    { key: "overview", label: t("Tổng quan") },
    { key: "access", label: t("Truy cập") },
  ];
}

export function operationsDivisions(): OperationsDivision[] {
  return [
    {
      key: "overview",
      label: t("Quản trị vận hành"),
      subTabs: [
        ...withReport(),
        report("untreated", t("Chẩn đoán chưa điều trị")),
        report("prescription", t("Đơn thuốc")),
      ],
    },
    { key: "assistant", label: t("Khối trợ lý"), subTabs: articleSubTabs() },
    { key: "reception", label: t("Khối lễ tân"), subTabs: withReport() },
    { key: "cskh", label: t("Khối CSKH"), subTabs: withReport() },
    { key: "marketing", label: t("Khối Marketing"), subTabs: withReport() },
    { key: "security", label: t("Khối bảo vệ"), subTabs: articleSubTabs() },
    {
      key: "treatment",
      label: t("Khối điều trị"),
      middleTabs: middleTabs(),
      subTabs: withReport(),
    },
    {
      key: "finance",
      label: t("Khối tài chính"),
      middleTabs: middleTabs(),
      // Its own six, in the reference's order — not the shared set.
      subTabs: [
        articles("home", t("Trang chủ")),
        report("customer-report", t("Khách hàng phát sinh")),
        articles("process", t("Quy trình")),
        articles("task", t("Công việc")),
        report("invoice", t("Hóa đơn")),
        report("service-complete", t("Hoàn thành theo dịch vụ")),
      ],
    },
  ];
}

export const DEFAULT_DIVISION = "overview";
export const DEFAULT_SUB_TAB = "home";
export const DEFAULT_MIDDLE_TAB = "overview";

export function findDivision(key: string | undefined): OperationsDivision {
  const all = operationsDivisions();
  return all.find((d) => d.key === key) ?? all[0];
}
