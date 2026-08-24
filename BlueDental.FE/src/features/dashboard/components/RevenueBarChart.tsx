import { Spin } from "antd";
import { useRevenueSeries, REVENUE_DAYS } from "../api/dashboardQueries";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

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
            {t("Doanh số {0} ngày gần nhất", REVENUE_DAYS)}
          </div>
          <div className="dash-card-sub">{t("Đơn vị: triệu đồng")}</div>
        </div>
      </div>

      {isLoading ? (
        <div className="dash-chart-loading">
          <Spin />
        </div>
      ) : (
        <div className="dash-chart">
          {bars.map((bar) => {
            const heightPct = Math.max((bar.amount / peak) * 100, 2);
            const millions = bar.amount / MILLION;
            return (
              <div key={bar.date} className="dash-bar-col">
                <span className="dash-bar-value">
                  {millions >= 1 ? millions.toFixed(1) : millions > 0 ? "<1" : "0"}
                </span>
                <div
                  className="dash-bar"
                  style={{
                    height: `${heightPct}%`,
                    background: bar.amount > 0 ? brand.blue : brand.lineSoft,
                  }}
                  title={`${bar.date}: ${bar.amount.toLocaleString("vi-VN")} ₫`}
                />
                <span className="dash-bar-label">{bar.weekday}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
