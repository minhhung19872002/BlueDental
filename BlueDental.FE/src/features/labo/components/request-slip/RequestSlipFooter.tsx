import type { ReactNode } from "react";
import { Button } from "antd";
import { SaveOutlined, SendOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  /** "Ca mới · R16, R17 · Sứ Lava +1 · Vai 90°". */
  summary: string;
  errors: string[];
  editable: boolean;
  saving: boolean;
  /** Hủy phiếu and In phiếu, for an order that already exists. */
  extra?: ReactNode;
  onClose: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
}

/**
 * The sticky foot of the Phiếu yêu cầu: the order in one line, what is still
 * missing in red (or "Phiếu đã đủ thông tin." in green), and the actions.
 * «Tạo phiếu Labo» waits until nothing is missing.
 */
export function RequestSlipFooter({ summary, errors, editable, saving, extra, onClose, onSaveDraft, onSubmit }: Props) {
  return (
    <footer className="rs-footer">
      <div className="rs-footer-sum">
        <span>{summary}</span>
        {editable &&
          (errors.length > 0 ? (
            <span className="rs-footer-err" role="status">
              {t("Labo:Spec:Errors", String(errors.length), errors.map((key) => t(key)).join(" · "))}
            </span>
          ) : (
            <span className="rs-footer-ok" role="status">
              {t("Labo:Slip:Complete")}
            </span>
          ))}
      </div>
      <div className="rs-footer-actions">
        <Button onClick={onClose}>{t("Labo:Workflow:Dismiss")}</Button>
        {extra}
        {editable && (
          <>
            <Button color="primary" variant="outlined" icon={<SaveOutlined />} loading={saving} disabled={saving} onClick={onSaveDraft}>
              {t("Labo:Workflow:SaveDraft")}
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={saving}
              disabled={saving || errors.length > 0}
              onClick={onSubmit}
            >
              {t("Labo:Workflow:CreateOrder")}
            </Button>
          </>
        )}
      </div>
    </footer>
  );
}
