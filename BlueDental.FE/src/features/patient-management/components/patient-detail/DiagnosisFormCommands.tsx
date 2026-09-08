import { Button } from "antd";
import { t } from "@/lib/i18n";
import type { DiagnosisIntent } from "../../hooks/useDiagnosisEditor";

interface Props {
  editing: boolean;
  ready: boolean;
  submitting: boolean;
  onSubmit: (intent: DiagnosisIntent) => void;
}

/**
 * The foot of the right-hand column. A new slip offers "Thêm chẩn đoán"
 * (queueing several diagnoses on one slip is not wired yet — the reference's
 * behaviour could not be observed — so it stays disabled), "Tạo dịch vụ" and
 * "Lưu Chẩn Đoán"; a slip opened from the table only "Cập nhật Chẩn Đoán".
 */
export function DiagnosisFormCommands({ editing, ready, submitting, onSubmit }: Props) {
  if (editing) {
    return (
      <Button
        className="pd-diagnosis-save"
        block
        disabled={!ready}
        loading={submitting}
        onClick={() => onSubmit("update")}
      >
        {t("Cập nhật Chẩn Đoán")}
      </Button>
    );
  }

  return (
    <>
      <Button type="primary" block disabled>
        {t("Thêm chẩn đoán")}
      </Button>
      <div className="pd-diagnosis-commands">
        <Button disabled={!ready} onClick={() => onSubmit("service")}>
          {t("Tạo dịch vụ")}
        </Button>
        <Button
          className="pd-diagnosis-save"
          disabled={!ready}
          loading={submitting}
          onClick={() => onSubmit("save")}
        >
          {t("Lưu Chẩn Đoán")}
        </Button>
      </div>
    </>
  );
}
