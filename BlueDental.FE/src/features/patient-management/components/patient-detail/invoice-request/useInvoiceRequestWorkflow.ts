import { useState } from "react";
import { toast } from "sonner";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  INVOICE_REQUEST_STATUS,
  useInvoiceRequestLink,
  useProcessInvoiceRequest,
  type InvoiceRequestDto,
} from "../../../api/invoiceRequestApi";
import type { InvoiceRequestFormTarget } from "./InvoiceRequestFormDialog";

/**
 * Which dialog is open over the request list, and Sao chép link which needs
 * none. Gated like the server: payment create edits and hands out links,
 * payment finalize sends a request (Xử lý) or withdraws it. Without a patient
 * — Tài chính › Hóa đơn đỏ — the list is only worked, never added to.
 */
export function useInvoiceRequestWorkflow(patientId?: string) {
  const ability = useAbility("payment");
  const canEdit = ability.canCreate;
  const canFinalize = ability.can("finalize");
  const [detail, setDetail] = useState<InvoiceRequestDto | null>(null);
  const [form, setForm] = useState<InvoiceRequestFormTarget | null>(null);
  const [toProcess, setToProcess] = useState<InvoiceRequestDto | null>(null);
  const [toWithdraw, setToWithdraw] = useState<InvoiceRequestDto | null>(null);
  const process = useProcessInvoiceRequest();
  const link = useInvoiceRequestLink();

  const followDetail = (updated: InvoiceRequestDto) =>
    setDetail((open) => (open?.id === updated.id ? updated : open));

  const handleProcess = () => {
    if (!toProcess) return;
    const again = toProcess.status === INVOICE_REQUEST_STATUS.Cancelled;
    process.mutate(toProcess.id, {
      onSuccess: (updated) => {
        toast.success(t(again ? "Patient:InvoiceRequest:Done:Reprocess" : "Patient:InvoiceRequest:Done:Process"));
        setToProcess(null);
        followDetail(updated);
      },
      // A refusal (CCCD, address, EasyInvoice) is toasted by the API layer;
      // the dialog closes so the request can be fixed with Sửa.
      onError: () => setToProcess(null),
    });
  };

  const handleWithdrawn = (updated: InvoiceRequestDto) => {
    setToWithdraw(null);
    followDetail(updated);
  };

  const handleCopyLink = (request: InvoiceRequestDto) =>
    link.mutate(request.patientPaymentId, {
      onSuccess: async ({ url, expiresAt }) => {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("Patient:InvoiceRequest:LinkCopied", formatDate(expiresAt)));
        } catch {
          // No clipboard (plain-HTTP host, denied permission): show the address to copy by hand.
          toast.info(url, { duration: 15000 });
        }
      },
    });

  const handleEdit = (request: InvoiceRequestDto) => {
    setDetail(null);
    setForm({ kind: "edit", request });
  };

  const onProcess = canFinalize ? setToProcess : undefined;
  const onWithdraw = canFinalize ? setToWithdraw : undefined;

  return {
    detail,
    form,
    toProcess,
    toWithdraw,
    processing: process.isPending,
    openDetail: setDetail,
    closeDetail: () => setDetail(null),
    openCreate: canEdit && patientId ? () => setForm({ kind: "create", patientId }) : undefined,
    closeForm: () => setForm(null),
    closeProcess: () => setToProcess(null),
    closeWithdraw: () => setToWithdraw(null),
    handleProcess,
    handleWithdrawn,
    rowHandlers: { onProcess, onWithdraw },
    detailHandlers: (request: InvoiceRequestDto) => ({
      onEdit: canEdit ? () => handleEdit(request) : undefined,
      onCopyLink: canEdit ? () => handleCopyLink(request) : undefined,
      onProcess: onProcess && (() => onProcess(request)),
      onWithdraw: onWithdraw && (() => onWithdraw(request)),
      copying: link.isPending,
    }),
  };
}
