import React from "react";
import { TeamOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

export const ReceptionEmptyState: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="reception-empty">
      <div className="reception-empty-icon">
        <TeamOutlined />
      </div>
      <h3 className="reception-empty-title">
        {t("reception.emptyState.title")}
      </h3>
      <p className="reception-empty-desc">
        {t("reception.emptyState.desc")}
      </p>
    </div>
  );
};
