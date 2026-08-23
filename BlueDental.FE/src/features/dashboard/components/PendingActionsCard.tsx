import { Spin } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { brand } from "@/theme/index";
import { useReceptionList } from "@/features/reception/api/receptionQueries";

export function PendingActionsCard() {
  const { t } = useTranslation();
  const { data, isLoading } = useReceptionList({ status: "WaitingForExam" });

  const waitingCount = data?.total ?? 0;

  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <div className="stat-card-label">{t("dashboard.pendingExam")}</div>
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
      <div className="stat-card-footer">{t("dashboard.pendingExamSubtitle")}</div>
    </div>
  );
}
