import { t } from "@/lib/i18n";
import type { PaymentReceiptDto } from "../../api/paymentReceiptApi";
import type { ReceiptSigningSessionDto } from "../../api/receiptSigningApi";
import type { AccountantSignatureState } from "../../hooks/useAccountantSignature";
import type { ReceiptExporter } from "../../hooks/useReceiptExport";
import type { ReceiptIpad } from "../../hooks/useReceiptIpad";
import type { ReceiptPrinter } from "../../hooks/useReceiptPrint";
import { ReceiptExportButton, ReceiptExportPanel, isExportReady } from "./ReceiptExportPanel";
import { ReceiptIpadControls, ReceiptIpadStatus } from "./ReceiptIpadControls";
import { ReceiptPaperConfirm } from "./ReceiptPaperConfirm";
import { ReceiptStatusPanel } from "./ReceiptStatusPanel";
import { customerSigned } from "./receiptSteps";

interface Props {
  receipt: PaymentReceiptDto;
  slipPath: string;
  ipad: ReceiptIpad;
  printer: ReceiptPrinter;
  exporter: ReceiptExporter;
  signature: AccountantSignatureState;
}

/** The column's heading, by where the customer is: on the iPad, signed there, or on paper. */
function titleOf(session: ReceiptSigningSessionDto | null, signed: { paper: boolean } | null): string | undefined {
  if (signed) return signed.paper ? t("Receipt:Panel:PaperTitle") : t("Receipt:Panel:SignedTitle");
  return session?.isOpen ? t("Receipt:Panel:AtIpadTitle") : undefined;
}

/**
 * The column of a receipt waiting on the customer (P2610, P2910_02). Until
 * they sign: the iPad buttons, and "In phiếu thu", which asks first since the
 * printout is then signed by hand at the counter. Once signed, on the iPad or
 * on paper: the time in the heading and the accountant's Ký điện tử / Token /
 * Ký tay with Xuất phiếu thu.
 */
export function ReceiptWaitingPanel({ receipt, slipPath, ipad, printer, exporter, signature }: Props) {
  const state = ipad.state;
  const signed = customerSigned(receipt, state?.session ?? null);
  const pending = printer.printing || printer.confirming;

  return (
    <>
      <ReceiptStatusPanel
        receipt={receipt}
        slipPath={slipPath}
        print={signed ? undefined : { run: printer.ask, pending }}
        waiting={{
          title: titleOf(state?.session ?? null, signed),
          notice: state && <ReceiptIpadStatus state={state} />,
          signed: signed ?? undefined,
        }}
        actions={
          state && (
            <ReceiptIpadControls
              state={state}
              paper={receipt.paperSignedAt !== null}
              pendingAction={ipad.pendingAction}
              confirmReplace={ipad.confirmReplace}
              handlers={ipad}
            />
          )
        }
        primary={
          signed && (
            <ReceiptExportButton
              signMode={exporter.signMode}
              ready={isExportReady(exporter.signMode, signature)}
              onExport={exporter.exportReceipt}
              exporting={exporter.exporting}
            />
          )
        }
      >
        {signed && (
          <ReceiptExportPanel
            signMode={exporter.signMode}
            onSignModeChange={exporter.setSignMode}
            exporting={exporter.exporting}
            signature={signature}
          />
        )}
      </ReceiptStatusPanel>
      <ReceiptPaperConfirm
        open={printer.asking}
        pending={printer.confirming}
        onConfirm={printer.printForPaper}
        onClose={printer.dismiss}
      />
    </>
  );
}
