// MedicalHistoryPanel — displays and allows editing of medical history notes.
// TODO: Implement rich text editing with auto-save.

import { Typography } from "antd";
import { t } from "@/lib/i18n";

interface Props {
  history: string | null;
}

export function MedicalHistoryPanel({ history }: Props) {
  if (!history) {
    return (
      <Typography.Text type="secondary">
        {t("Patient:NoMedicalHistory")}
      </Typography.Text>
    );
  }

  return (
    <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>
      {history}
    </Typography.Paragraph>
  );
}
