import { Spin } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { brand } from "@/theme/index";
import { useReceptionList } from "@/features/reception/api/receptionQueries";

export function PendingActionsCard() {
  const { data, isLoading } = useReceptionList({ status: "WaitingForExam" });

  const waitingCount = data?.total ?? 0;

  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <div className="stat-card-label">Đang chờ khám</div>
          {isLoading ? (
            <Spin size="small" style={{ marginTop: 8 }} />
          ) : (
            <div className="stat-card-value">{waitingCount}</div>
          )}
        </div>
        <div className="stat-card-icon" style={{ background: "#FFF3E0", color: brand.amber }}>
          <ExclamationCircleOutlined />
        </div>
      </div>
      <div className="stat-card-footer">Bệnh nhân chờ tiếp nhận hôm nay</div>
    </div>
  );
}
