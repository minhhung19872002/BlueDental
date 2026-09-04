import { useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import { ReportToolbar } from "../components/ReportToolbar";
import { ExpenseTab } from "../components/ExpenseTab";
import { CashflowTab } from "../components/CashflowTab";
import { BusinessResultTab } from "../components/BusinessResultTab";
import { CashflowV2Tab } from "../components/CashflowV2Tab";
import type { ReportViewMode } from "../types/viewMode";
import "../components/report.css";

type ReportTabKey = "expense" | "cashflow" | "result" | "cashflow-v2";

const REPORT_TABS: { key: ReportTabKey; label: () => string }[] = [
  { key: "expense", label: () => t("Doanh số và lượt khách") },
  { key: "cashflow", label: () => t("Quản lý thu chi") },
  { key: "result", label: () => t("Kết quả kinh doanh") },
  { key: "cashflow-v2", label: () => t("Luân chuyển dòng tiền V2") },
];

/** Tabs where the reference hides the "Bác sĩ điều trị" filter. */
const TABS_WITHOUT_DOCTOR: ReportTabKey[] = ["result"];

function getBounds(mode: ReportViewMode, date: Dayjs) {
  if (mode === "day") return { start: date, end: date };
  if (mode === "week") return { start: date.startOf("week"), end: date.endOf("week") };
  if (mode === "month") return { start: date.startOf("month"), end: date.endOf("month") };
  return { start: date.startOf("year"), end: date.endOf("year") };
}

/**
 * /report — one white shell like the reference: period toolbar on top,
 * underline main tabs, then the active tab's content. No page header.
 */
export function ReportPage() {
  const [viewMode, setViewMode] = useState<ReportViewMode>("month");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [activeTab, setActiveTab] = useState<ReportTabKey>("expense");
  const [doctorId, setDoctorId] = useState<string | undefined>();

  const bounds = getBounds(viewMode, currentDate);
  const range = {
    fromDate: bounds.start.format("YYYY-MM-DD"),
    toDate: bounds.end.format("YYYY-MM-DD"),
  };

  const tabItems = REPORT_TABS.map((tab) => ({ key: tab.key, label: tab.label() }));

  return (
    <div className="report-page">
      <section className="report-shell" aria-label={t("Báo cáo")}>
        <ReportToolbar
          viewMode={viewMode}
          currentDate={currentDate}
          doctorId={doctorId}
          showDoctor={!TABS_WITHOUT_DOCTOR.includes(activeTab)}
          onViewModeChange={setViewMode}
          onDateChange={setCurrentDate}
          onDoctorChange={setDoctorId}
        />

        <PillTabs
          className="report-main-tabs"
          items={tabItems}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as ReportTabKey)}
        />

        {activeTab === "expense" && <ExpenseTab {...range} doctorId={doctorId} />}
        {activeTab === "cashflow" && <CashflowTab {...range} />}
        {activeTab === "result" && <BusinessResultTab {...range} />}
        {activeTab === "cashflow-v2" && <CashflowV2Tab />}
      </section>
    </div>
  );
}
