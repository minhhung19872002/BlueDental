import { useMemo } from "react";
import { Empty, Spin } from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import {
  useConsultantSummary,
  type ConsultantSummaryRow,
} from "@/features/operations/api/operationReportApi";
import { formatVND } from "@/utils/format";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

function aggregate(items: ConsultantSummaryRow[]) {
  let newCount = 0;
  let retCount = 0;
  let newRev = 0;
  let retRev = 0;
  for (const row of items) {
    newCount += row.newPatientConsultations;
    retCount += row.returningPatientConsultations;
    newRev += row.newPatientRevenue;
    retRev += row.returningPatientRevenue;
  }
  return { newCount, retCount, newRev, retRev, total: newCount + retCount };
}

export function PatientInsightCard() {
  const navigate = useNavigate();

  const window = useMemo(() => ({
    periodCode: 1,
    anchorIso: dayjs().startOf("day").toISOString(),
    skipCount: 0,
    maxResultCount: 200,
  }), []);

  const { data, isLoading, isError } = useConsultantSummary(window);

  const agg = aggregate(data?.items ?? []);

  return (
    <div className="page-card">
      <div className="dash-card-head" style={{ marginBottom: 12 }}>
        <div className="dash-card-title">{t("Khách hàng phát sinh")}</div>
        <button
          type="button"
          className="dash-link"
          onClick={() => navigate("/operations/finance?financeSubTab=customer-report")}
        >
          {t("Chi tiết →")}
        </button>
      </div>

      {isLoading ? (
        <Spin size="small" />
      ) : isError || agg.total === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("Chưa có khách hàng phát sinh hôm nay")}
        />
      ) : (
        <div className="dash-insight-rows">
          <div className="dash-insight-row">
            <span
              className="dash-avatar"
              style={{ background: `${brand.green}18`, color: brand.green }}
            >
              {agg.newCount}
            </span>
            <span className="dash-row-main">
              <span className="dash-row-title">{t("Khách mới")}</span>
              <span className="dash-row-sub">
                {formatVND(agg.newRev)} ₫
              </span>
            </span>
          </div>
          <div className="dash-insight-row">
            <span
              className="dash-avatar"
              style={{ background: `${brand.blue}18`, color: brand.blue }}
            >
              {agg.retCount}
            </span>
            <span className="dash-row-main">
              <span className="dash-row-title">{t("Khách cũ")}</span>
              <span className="dash-row-sub">
                {formatVND(agg.retRev)} ₫
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
