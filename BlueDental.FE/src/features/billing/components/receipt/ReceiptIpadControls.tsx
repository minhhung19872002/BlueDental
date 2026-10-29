import { Button } from "antd";
import { PenLine, RotateCcw, Send, Tablet, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import { formatClockSeconds } from "@/utils/format";
import type { ReceiptSigningStateDto } from "../../api/receiptSigningApi";
import type { IpadAction } from "../../hooks/useReceiptIpad";

interface Props {
  state: ReceiptSigningStateDto;
  /** Printed for the customer to sign by hand: the iPad is out of it. */
  paper: boolean;
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

/** The callout under the column's heading: where the customer is on the iPad. */
export function ReceiptIpadStatus({ state }: { state: ReceiptSigningStateDto }) {
  return (
    <p className="rcpt-ipad-status">
      <Tablet size={18} aria-hidden="true" />
      <span>{ipadStatusText(state)}</span>
    </p>
  );
}

/**
 * The iPad buttons at the foot of the status column while the receipt waits
 * (P2610): Gửi tới iPad, or — once the iPad shows it — Gửi lại and Hủy phiên &
 * sửa phiếu; after the customer signed, Yêu cầu khách ký lại takes Gửi lại's
 * place, Xuất phiếu thu sits beside it and Hủy phiên drops to the line below.
 * When the iPad shows another receipt the cashier may wait, or end that
 * session and send this one. Printed for signing by hand (P2910_02), only Hủy
 * phiên & sửa phiếu is left: it takes the receipt back from paper.
 */
export function ReceiptIpadControls({ state, paper, pendingAction, confirmReplace, handlers }: Props) {
  const open = state.session?.isOpen ? state.session : null;
  const busy = pendingAction !== null;
  const loading = (action: IpadAction) => pendingAction === action;

  const cancelButton = (below: boolean) => (
    <Button
      danger
      className={below ? "rcpt-ipad-cancel-below" : undefined}
      icon={<RotateCcw size={16} aria-hidden="true" />}
      loading={loading("cancel")}
      disabled={busy}
      onClick={handlers.cancel}
    >
      {t("Receipt:Ipad:Cancel")}
    </Button>
  );

  if (paper) return cancelButton(true);

  return (
    <>
      {state.hasDevice && (
        <>
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
              {!open.signedAt && (
                <Button icon={<Send size={16} aria-hidden="true" />} loading={loading("send")} disabled={busy} onClick={handlers.send}>
                  {t("Receipt:Ipad:Resend")}
                </Button>
              )}
              {open.signedAt && (
                <Button icon={<PenLine size={16} aria-hidden="true" />} loading={loading("resign")} disabled={busy} onClick={handlers.resign}>
                  {t("Receipt:Ipad:Resign")}
                </Button>
              )}
              {cancelButton(Boolean(open.signedAt))}
            </>
          )}
        </>
      )}
      <ConfirmDialog
        open={confirmReplace}
        message={t("Receipt:Ipad:ReplaceConfirm", state.busyWithCode ?? "")}
        confirmLabel={t("Receipt:Ipad:ReplaceConfirmOk")}
        pending={loading("replace")}
        onConfirm={handlers.replace}
        onClose={handlers.closeReplace}
      />
    </>
  );
}
