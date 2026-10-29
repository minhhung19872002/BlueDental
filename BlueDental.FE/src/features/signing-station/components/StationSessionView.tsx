import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { describeApiError } from "@/lib/apiError";
import {
  STATION_STAGE,
  type StationStage,
  useCheckReceipt,
  useRequestStationInvoice,
  useSignReceipt,
  type SigningStationDto,
  type StationInvoiceRequestDto,
  type StationReceiptDto,
} from "../api/signingStationApi";
import { InvoiceRequestForm } from "./InvoiceRequestForm";
import { PrintedScreen } from "./PrintedScreen";
import { ReviewScreen } from "./ReviewScreen";
import { SignScreen } from "./SignScreen";
import { STATION_LOGO, StationShell } from "./StationShell";
import { stationSteps } from "./stationSteps";
import { IdleScreen, IssuedScreen, ThanksScreen } from "./StationNotices";

/** SigningSessionClosed: the cashier ended or replaced the session — the refetch shows what is next. */
const SESSION_CLOSED = "BlueDental:Billing:0103";

/** The message to show, or none when the refused screen is simply out of date. */
function refusalOf(error: unknown): string | null {
  const info = describeApiError(error);
  return info.code === SESSION_CLOSED ? null : info.message;
}

interface Props {
  station: SigningStationDto & { sessionId: string; paymentCode: string; receipt: StationReceiptDto };
}

/**
 * One receipt on the iPad, keyed by its session so a new receipt starts clean.
 * The server says which step the customer is on; this keeps only the local
 * detours: the invoice form, "Quay lại" from the pad, and the Issued timeout.
 */
export function StationSessionView({ station }: Props) {
  const { sessionId, paymentCode, receipt } = station;
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [reviewAgain, setReviewAgain] = useState(false);
  const [issuedDone, setIssuedDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useCheckReceipt();
  const sign = useSignReceipt();
  const invoice = useRequestStationInvoice();
  const handleIssuedDone = useCallback(() => setIssuedDone(true), []);
  /** The frame; `stepsAt` null hides the step bar (welcome screen). */
  const frame = (node: ReactNode, stepsAt: StationStage | null) => (
    <StationShell clinicName={station.clinicName} steps={stepsAt === null ? undefined : stationSteps(stepsAt)}>
      {node}
    </StationShell>
  );

  const handleConfirm = () =>
    check.mutate(sessionId, {
      onSuccess: () => setReviewAgain(false),
      onError: (err) => {
        const message = refusalOf(err);
        if (message) toast.error(message);
      },
    });

  const handleSign = (signatureDataUrl: string) => {
    setError(null);
    sign.mutate({ sessionId, signatureDataUrl }, { onError: (err) => setError(refusalOf(err)) });
  };

  const handleInvoice = (body: StationInvoiceRequestDto) => {
    setError(null);
    invoice.mutate({ sessionId, body }, { onSuccess: () => setInvoiceOpen(false), onError: (err) => setError(refusalOf(err)) });
  };

  const openInvoice = () => {
    setError(null);
    setInvoiceOpen(true);
  };

  if (station.stage === STATION_STAGE.Issued || station.stage === STATION_STAGE.Printed) {
    if (issuedDone) return frame(<IdleScreen />, null);
  }
  if (station.stage === STATION_STAGE.Issued) {
    return frame(<IssuedScreen amount={receipt.amount} issuedAt={station.issuedAt} onDone={handleIssuedDone} />, station.stage);
  }
  // Printed for a hand signature: the iPad's steps were never walked, so no step bar.
  if (station.stage === STATION_STAGE.Printed) {
    return frame(
      <PrintedScreen
        paymentCode={paymentCode}
        payerName={receipt.payerName}
        amount={receipt.amount}
        onDone={handleIssuedDone}
      />,
      null,
    );
  }
  if (station.stage === STATION_STAGE.Signed) {
    return frame(<ThanksScreen signatureDataUrl={station.signatureDataUrl} />, station.stage);
  }

  // The invoice form and "Quay lại" both sit back on Kiểm tra phiếu thu.
  if (invoiceOpen) {
    return frame(
      <InvoiceRequestForm
        paymentCode={paymentCode}
        amount={receipt.amount}
        saving={invoice.isPending}
        error={error}
        onCancel={() => setInvoiceOpen(false)}
        onSave={handleInvoice}
      />,
      STATION_STAGE.Review,
    );
  }

  if (station.stage === STATION_STAGE.Signing && !reviewAgain) {
    return frame(
      <SignScreen
        payerName={receipt.payerName}
        paymentCode={paymentCode}
        amount={receipt.amount}
        signing={sign.isPending}
        error={error}
        onBack={() => setReviewAgain(true)}
        onSign={handleSign}
      />,
      station.stage,
    );
  }

  return frame(
    <ReviewScreen
      receipt={{ code: paymentCode, content: receipt }}
      clinic={{ name: station.clinicName, logoUrl: STATION_LOGO }}
      invoiceRequested={station.invoiceRequested}
      confirming={check.isPending}
      onRequestInvoice={openInvoice}
      onConfirm={handleConfirm}
    />,
    STATION_STAGE.Review,
  );
}
