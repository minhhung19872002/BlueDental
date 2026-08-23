// MedicalHistoryPanel — displays and allows editing of medical history notes.
// TODO: Implement rich text editing with auto-save.

import { Typography } from "antd";
import { useTranslation } from "react-i18next";

interface Props {
  history: string | null;
}

export function MedicalHistoryPanel({ history }: Props) {
  const { t } = useTranslation();
  if (!history) {
    return (
      <Typography.Text type="secondary">
        {t("treatment.noMedicalHistory")}
      </Typography.Text>
    );
  }

  return (
    <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
      {history}
    </Typography.Paragraph>
  );
}
