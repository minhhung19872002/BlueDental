import React from "react";
import { TeamOutlined } from "@ant-design/icons";

export const ReceptionEmptyState: React.FC = () => {
  return (
    <div className="reception-empty">
      <div className="reception-empty-icon">
        <TeamOutlined />
      </div>
      <h3 className="reception-empty-title">
        Không có lượt tiếp nhận phù hợp
      </h3>
      <p className="reception-empty-desc">
        Hãy thử đổi bộ lọc hoặc từ khoá tìm kiếm để xem thêm dữ liệu.
      </p>
    </div>
  );
};
