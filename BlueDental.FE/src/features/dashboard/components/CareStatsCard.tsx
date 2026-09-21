import { Empty, Spin } from "antd";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { useCareStats } from "@/features/cskh/api/careApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

export function CareStatsCard() {
  const navigate = useNavigate();
  const branchId = useCurrentBranchId();
  const today = dayjs().format("YYYY-MM-DD");

  const { data, isLoading, isError } = useCareStats(
    { branchId, fromDate: today, toDate: today },
  );

  const total = data ? data.succeeded + data.failed + data.notCaredYet : 0;

  return (
    <div className="page-card">
      <div className="dash-card-head" style={{ marginBottom: 12 }}>
        <div className="dash-card-title">{t("Chăm sóc khách hàng")}</div>
        <button
          type="button"
          className="dash-link"
          onClick={() => navigate("/cskh-grouping")}
        >
          {t("Xem tất cả →")}
        </button>
      </div>

      {isLoading ? (
        <Spin size="small" />
      ) : isError || total === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("Không có lịch chăm sóc hôm nay")}
        />
      ) : (
        <div className="dash-care-grid">
          <div className="dash-care-item">
            <span
              className="dash-care-dot"
              style={{ background: brand.blue }}
            />
            <span className="dash-care-label">{t("Tổng")}</span>
            <span className="dash-care-value">{total}</span>
          </div>
          <div className="dash-care-item">
            <span
              className="dash-care-dot"
              style={{ background: brand.green }}
            />
            <span className="dash-care-label">{t("Thành công")}</span>
            <span className="dash-care-value" style={{ color: brand.green }}>
              {data!.succeeded}
            </span>
          </div>
          <div className="dash-care-item">
            <span
              className="dash-care-dot"
              style={{ background: brand.amber }}
            />
            <span className="dash-care-label">{t("Chưa chăm sóc")}</span>
            <span className="dash-care-value" style={{ color: brand.amber }}>
              {data!.notCaredYet}
            </span>
          </div>
          <div className="dash-care-item">
            <span
              className="dash-care-dot"
              style={{ background: brand.red }}
            />
            <span className="dash-care-label">{t("Phàn nàn")}</span>
            <span className="dash-care-value" style={{ color: brand.red }}>
              {data!.complaint}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
