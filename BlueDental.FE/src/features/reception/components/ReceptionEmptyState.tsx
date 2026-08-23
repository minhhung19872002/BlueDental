import React from "react";
import { TeamOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

export const ReceptionEmptyState: React.FC = () => {
  return (
    <div className="reception-empty">
      <div className="reception-empty-icon">
        <TeamOutlined />
      </div>
      <h3 className="reception-empty-title">
        {t("Không có lượt tiếp nhận phù hợp")}
      </h3>
      <p className="reception-empty-desc">
        {t("Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm để xem thêm dữ liệu.")}
      </p>
    </div>
  );
};
