import { Spin } from "antd";
import { DollarOutlined } from "@ant-design/icons";
import { brand } from "@/theme/index";
import { useRevenueReport } from "@/features/report/api/reportingApi";
import { formatVND } from "@/utils/format";
import dayjs from "dayjs";

export function RevenueSummaryCard() {
  const today = dayjs().format("YYYY-MM-DD");
  const { data, isLoading } = useRevenueReport({ startDate: today, endDate: today });

  const totalRevenue = Array.isArray(data)
    ? data.reduce((sum, d) => sum + (d.totalRevenue ?? 0), 0)
    : 0;

  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <div className="stat-card-label">Doanh thu hôm nay</div>
          {isLoading ? (
            <Spin size="small" style={{ marginTop: 8 }} />
          ) : (
            <div className="stat-card-value">{formatVND(totalRevenue)} đ</div>
          )}
        </div>
        <div className="stat-card-icon" style={{ background: "#E8F5E9", color: brand.green }}>
          <DollarOutlined />
        </div>
      </div>
      <div className="stat-card-footer">Tổng doanh thu trong ngày</div>
    </div>
  );
}
