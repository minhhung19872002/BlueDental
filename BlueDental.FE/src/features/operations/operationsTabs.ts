import { t } from "@/lib/i18n";

/**
 * The eight divisions the reference lists across the top, in its order, and the
 * sub-tabs each one offers.
 *
 * Both come straight from the reference's own navigation: each division is its
 * own route (`/operations/<key>`) and the sub-tab travels in the query string,
 * so a screen here can be linked to exactly as it can there.
 */
export interface OperationsSubTab {
  key: string;
  label: string;
}

export interface OperationsDivision {
  key: string;
  label: string;
  subTabs: OperationsSubTab[];
}

/** Every division offers these three; the wider ones add to them. */
function baseSubTabs(): OperationsSubTab[] {
  return [
    { key: "home", label: t("Trang chủ") },
    { key: "process", label: t("Quy trình") },
    { key: "task", label: t("Công việc") },
  ];
}

export function operationsDivisions(): OperationsDivision[] {
  const withReport = (): OperationsSubTab[] => [
    ...baseSubTabs(),
    { key: "report", label: t("Báo cáo") },
  ];

  return [
    {
      key: "overview",
      label: t("Quản trị vận hành"),
      subTabs: [
        ...withReport(),
        { key: "untreated", label: t("Chẩn đoán chưa điều trị") },
        { key: "prescription", label: t("Đơn thuốc") },
      ],
    },
    { key: "assistant", label: t("Khối trợ lý"), subTabs: baseSubTabs() },
    { key: "reception", label: t("Khối lễ tân"), subTabs: withReport() },
    { key: "cskh", label: t("Khối CSKH"), subTabs: withReport() },
    { key: "marketing", label: t("Khối Marketing"), subTabs: withReport() },
    { key: "security", label: t("Khối bảo vệ"), subTabs: withReport() },
    { key: "treatment", label: t("Khối điều trị"), subTabs: withReport() },
    { key: "finance", label: t("Khối tài chính"), subTabs: withReport() },
  ];
}

export const DEFAULT_DIVISION = "overview";
export const DEFAULT_SUB_TAB = "home";

export function findDivision(key: string | undefined): OperationsDivision {
  const all = operationsDivisions();
  return all.find((d) => d.key === key) ?? all[0];
}
