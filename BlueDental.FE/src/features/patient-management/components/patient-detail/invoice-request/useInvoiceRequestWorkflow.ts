import { useState } from "react";
import { toast } from "sonner";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  useInvoiceRequestLink,
  useStartInvoiceRequest,
  type InvoiceRequestDto,
} from "../../../api/invoiceRequestApi";
import type { InvoiceRequestAction, InvoiceRequestActionKind } from "./InvoiceRequestActionDialog";
import type { InvoiceRequestFormTarget } from "./InvoiceRequestFormDialog";

/**
 * Which dialog is open over the request list, and the two actions that need
 * none (Xử lý, Sao chép link). Gated like the server: payment create edits and
 * hands out links, payment finalize moves a request along.
 */
export function useInvoiceRequestWorkflow(patientId: string) {
  const ability = useAbility("payment");
  const canEdit = ability.canCreate;
  const canFinalize = ability.can("finalize");
  const [detail, setDetail] = useState<InvoiceRequestDto | null>(null);
  const [form, setForm] = useState<InvoiceRequestFormTarget | null>(null);
  const [action, setAction] = useState<InvoiceRequestAction | null>(null);
  const start = useStartInvoiceRequest();
  const link = useInvoiceRequestLink();

  const handleStart = (request: InvoiceRequestDto) =>
    start.mutate(request.id, {
      onSuccess: (updated) => {
        toast.success(t("Patient:InvoiceRequest:Done:Start"));
        setDetail((open) => (open?.id === updated.id ? updated : open));
      },
    });

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

  const openAction = (request: InvoiceRequestDto, kind: InvoiceRequestActionKind) =>
    setAction({ kind, request });

  const handleActionDone = (updated: InvoiceRequestDto) => {
    setAction(null);
    setDetail((open) => (open?.id === updated.id ? updated : open));
  };

  const handleEdit = (request: InvoiceRequestDto) => {
    setDetail(null);
    setForm({ kind: "edit", request });
  };

  return {
    canFinalize,
    detail,
    form,
    action,
    openDetail: setDetail,
    closeDetail: () => setDetail(null),
    openCreate: canEdit ? () => setForm({ kind: "create", patientId }) : undefined,
    closeForm: () => setForm(null),
    closeAction: () => setAction(null),
    start: canFinalize ? handleStart : undefined,
    complete: canFinalize ? (request: InvoiceRequestDto) => openAction(request, "complete") : undefined,
    handleActionDone,
    detailHandlers: (request: InvoiceRequestDto) => ({
      onEdit: canEdit ? () => handleEdit(request) : undefined,
      onCopyLink: canEdit ? () => handleCopyLink(request) : undefined,
      onStart: canFinalize ? () => handleStart(request) : undefined,
      onAction: canFinalize ? (kind: InvoiceRequestActionKind) => openAction(request, kind) : undefined,
      starting: start.isPending,
      copying: link.isPending,
    }),
  };
}
