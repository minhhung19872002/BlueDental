import { useMemo, useState } from "react";
import type { Dayjs } from "dayjs";
import { PageHeader } from "@/components/PageHeader";
import { PillTabs } from "@/components/PillTabs";
import { useAuthStore } from "@/features/auth/store/authStore";
import { t } from "@/lib/i18n";
import { ReportToolbar } from "../components/ReportToolbar";
import { ExpenseTab } from "../components/ExpenseTab";
import { CashflowTab } from "../components/CashflowTab";
import { BusinessResultTab } from "../components/BusinessResultTab";
import { CashflowV2Tab } from "../components/CashflowV2Tab";
import { REPORT_PERMISSION } from "../hooks/useReportPermissions";
import { useReportUrlState, type ReportTabKey } from "../hooks/useReportUrlState";
import type { ReportViewMode } from "../types/viewMode";
import "../components/report.css";

const REPORT_TABS: { key: ReportTabKey; label: () => string; permissions: string[] }[] = [
  { key: "sales", label: () => t("Doanh số và lượt khách"), permissions: [REPORT_PERMISSION.salesRead] },
  { key: "cashflow", label: () => t("Quản lý thu chi"), permissions: [REPORT_PERMISSION.incomeRead, REPORT_PERMISSION.costRead, REPORT_PERMISSION.cashflowCategoryRead] },
  { key: "result", label: () => t("Kết quả kinh doanh"), permissions: [REPORT_PERMISSION.resultRead] },
  { key: "cashflow-v2", label: () => t("Luân chuyển dòng tiền V2"), permissions: [REPORT_PERMISSION.transferRead, REPORT_PERMISSION.transferCategoryRead] },
];

/** Tabs where the reference hides the "Bác sĩ điều trị" filter. */
const TABS_WITHOUT_DOCTOR: ReportTabKey[] = ["result"];

/** Tabs where the reference replaces the date navigator with a locked "Tổng" (all-time). */
const TABS_WITH_LOCKED_PERIOD: ReportTabKey[] = ["cashflow-v2"];

function getBounds(mode: ReportViewMode, date: Dayjs) {
  if (mode === "day") return { start: date, end: date };
  if (mode === "week") return { start: date.startOf("week"), end: date.endOf("week") };
  if (mode === "month") return { start: date.startOf("month"), end: date.endOf("month") };
  return { start: date.startOf("year"), end: date.endOf("year") };
}

/**
 * /report — one white shell like the reference: period toolbar on top,
 * underline main tabs, then the active tab's content. Tab, period and date
 * live in the URL like the reference's, so a link reopens the same view.
 */
export function ReportPage() {
  const {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    currentDate,
    setCurrentDate,
    salesSub,
    setSalesSub,
    cashflowSub,
    setCashflowSub,
  } = useReportUrlState();
  const [doctorId, setDoctorId] = useState<string | undefined>();
  const permissions = useAuthStore((s) => s.user?.permissions);
  const grantedSet = useMemo(() => new Set(permissions ?? []), [permissions]);

  const bounds = getBounds(viewMode, currentDate);
  const range = {
    fromDate: bounds.start.format("YYYY-MM-DD"),
    toDate: bounds.end.format("YYYY-MM-DD"),
  };

  const visibleTabs = useMemo(
    () => REPORT_TABS.filter((tab) => tab.permissions.some((p) => grantedSet.has(p))),
    [grantedSet],
  );
  const safeTab: ReportTabKey = visibleTabs.some((t) => t.key === activeTab)
    ? activeTab
    : (visibleTabs[0]?.key ?? activeTab);
  const tabItems = visibleTabs.map((tab) => ({ key: tab.key, label: tab.label() }));

  return (
    <div className="report-page">
      <PageHeader
        title={t("Báo cáo")}
        subtitle={t("Doanh thu, chi phí và kết quả kinh doanh theo kỳ")}
      />

      <section className="report-shell" aria-label={t("Báo cáo")}>
        <ReportToolbar
          viewMode={viewMode}
          currentDate={currentDate}
          doctorId={doctorId}
          showDoctor={!TABS_WITHOUT_DOCTOR.includes(safeTab)}
          periodLocked={TABS_WITH_LOCKED_PERIOD.includes(safeTab)}
          onViewModeChange={setViewMode}
          onDateChange={setCurrentDate}
          onDoctorChange={setDoctorId}
        />

        <PillTabs
          className="report-main-tabs"
          items={tabItems}
          activeKey={safeTab}
          onChange={(key) => setActiveTab(key as ReportTabKey)}
        />

        {safeTab === "sales" && <ExpenseTab {...range} doctorId={doctorId} sub={salesSub} onSubChange={setSalesSub} />}
        {safeTab === "cashflow" && <CashflowTab {...range} sub={cashflowSub} onSubChange={setCashflowSub} />}
        {safeTab === "result" && <BusinessResultTab {...range} />}
        {safeTab === "cashflow-v2" && <CashflowV2Tab />}
      </section>
    </div>
  );
}
