// MedicalHistoryPanel — displays and allows editing of medical history notes.
// TODO: Implement rich text editing with auto-save.

import { t } from "@/lib/i18n";

interface Props {
  history: string | null;
}

export function MedicalHistoryPanel({ history }: Props) {
  if (!history) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("Chưa có thông tin tiền sử bệnh.")}
      </p>
    );
  }

  return (
    <p className="text-sm whitespace-pre-wrap leading-relaxed">
      {history}
    </p>
  );
}
