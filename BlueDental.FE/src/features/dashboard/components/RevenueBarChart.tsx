import { Spin } from "antd";
import { useRevenueSeries, REVENUE_DAYS } from "../api/dashboardQueries";
import { getLocale, t } from "@/lib/i18n";

const MILLION = 1_000_000;

/** Bars are scaled against the tallest day, with a floor so an empty week still draws. */
export function RevenueBarChart() {
  const { bars, isLoading } = useRevenueSeries();
  const peak = Math.max(...bars.map((b) => b.amount), 1);

  return (
    <div className="page-card dash-chart-card">
      <div className="dash-card-head">
        <div>
          <div className="dash-card-title">
            {t("Dashboard:RevenueChartTitle", REVENUE_DAYS)}
          </div>
          <div className="dash-card-sub">{t("Dashboard:RevenueChartUnit")}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="dash-chart-loading">
          <Spin />
        </div>
      ) : (
        <div className="dash-chart">
          {bars.map((bar, i) => {
            const heightPct = Math.max((bar.amount / peak) * 100, 2);
            const millions = bar.amount / MILLION;
            /* The design lights the last column and greys the rest, and names
               it Hôm nay rather than by its weekday. */
            const isToday = i === bars.length - 1;
            return (
              <div key={bar.date} className="dash-bar-col">
                <span className="dash-bar-value">
                  {millions >= 1 ? `${millions.toFixed(1)} ${t("Dashboard:RevenueMillion")}` : millions > 0 ? t("Dashboard:RevenueLessThanMillion") : "0"}
                </span>
                <div
                  className={`dash-bar${isToday ? " dash-bar--today" : ""}`}
                  style={{ height: `${heightPct}%` }}
                  title={`${bar.date}: ${bar.amount.toLocaleString(getLocale())} ₫`}
                />
                <span className="dash-bar-label">
                  {isToday ? t("Dashboard:RevenueToday") : bar.weekday}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
