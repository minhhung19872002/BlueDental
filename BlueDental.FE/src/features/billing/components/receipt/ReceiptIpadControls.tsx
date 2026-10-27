import { Button } from "antd";
import { PenLine, RotateCcw, Send, Tablet, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import { formatClockSeconds } from "@/utils/format";
import type { ReceiptSigningStateDto } from "../../api/receiptSigningApi";
import type { IpadAction } from "../../hooks/useReceiptIpad";

interface Props {
  state: ReceiptSigningStateDto;
  pendingAction: IpadAction | null;
  confirmReplace: boolean;
  handlers: {
    send: () => void;
    openReplace: () => void;
    closeReplace: () => void;
    replace: () => void;
    cancel: () => void;
    resign: () => void;
  };
}

/** The line saying where the customer is on the iPad. */
export function ipadStatusText(state: ReceiptSigningStateDto): string {
  const open = state.session?.isOpen ? state.session : null;
  if (!state.hasDevice) return t("Receipt:Ipad:NoDevice");
  if (open?.signedAt) return t("Receipt:Ipad:Signed", formatClockSeconds(open.signedAt));
  if (open?.checkedAt) return t("Receipt:Ipad:Signing");
  if (open) return t("Receipt:Ipad:Reviewing");
  if (state.busyWithCode) return t("Receipt:Ipad:Busy", state.busyWithCode);
  return t("Receipt:Ipad:NotSent");
}

/**
 * The iPad part of the status column while the receipt waits (P2610):
 * Gửi tới iPad, or — once the iPad shows it — Gửi lại, Hủy phiên & sửa phiếu
 * and, after the customer signed, Yêu cầu khách ký lại. When the iPad shows
 * another receipt the cashier may wait, or end that session and send this one.
 */
export function ReceiptIpadControls({ state, pendingAction, confirmReplace, handlers }: Props) {
  const open = state.session?.isOpen ? state.session : null;
  const busy = pendingAction !== null;
  const loading = (action: IpadAction) => pendingAction === action;

  return (
    <div className="rcpt-ipad">
      <p className="rcpt-ipad-status">
        <Tablet size={16} aria-hidden="true" />
        <span>{ipadStatusText(state)}</span>
      </p>
      {state.hasDevice && (
        <div className="rcpt-ipad-actions">
          {!open && !state.busyWithCode && (
            <Button type="primary" icon={<Send size={16} aria-hidden="true" />} loading={loading("send")} disabled={busy} onClick={handlers.send}>
              {t("Receipt:Ipad:Send")}
            </Button>
          )}
          {!open && state.busyWithCode && (
            <Button danger icon={<XCircle size={16} aria-hidden="true" />} disabled={busy} onClick={handlers.openReplace}>
              {t("Receipt:Ipad:Replace")}
            </Button>
          )}
          {open && (
            <>
              <Button icon={<Send size={16} aria-hidden="true" />} loading={loading("send")} disabled={busy} onClick={handlers.send}>
                {t("Receipt:Ipad:Resend")}
              </Button>
              {open.signedAt && (
                <Button icon={<PenLine size={16} aria-hidden="true" />} loading={loading("resign")} disabled={busy} onClick={handlers.resign}>
                  {t("Receipt:Ipad:Resign")}
                </Button>
              )}
              <Button danger icon={<RotateCcw size={16} aria-hidden="true" />} loading={loading("cancel")} disabled={busy} onClick={handlers.cancel}>
                {t("Receipt:Ipad:Cancel")}
              </Button>
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmReplace}
        message={t("Receipt:Ipad:ReplaceConfirm", state.busyWithCode ?? "")}
        confirmLabel={t("Receipt:Ipad:ReplaceConfirmOk")}
        pending={loading("replace")}
        onConfirm={handlers.replace}
        onClose={handlers.closeReplace}
      />
    </div>
  );
}
