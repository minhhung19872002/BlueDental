import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import { useCreateSend, useSendTest, type CreateSendInput, type SendPreviewInput } from "../api/sendApi";

/** What the confirm dialog asks about and then sends. */
export interface SendRequest {
  input: CreateSendInput;
  count: number;
  channelName: string;
  templateName: string;
}

/**
 * The CTA asks first: a sent message cannot be called back. Errors reach the
 * user through the mutation cache's toast; the dialog stays open on one.
 */
export function useSendSubmit(onSent: () => void) {
  const create = useCreateSend();
  const test = useSendTest();
  const [request, setRequest] = useState<SendRequest | null>(null);

  const confirm = () => {
    if (!request) return;
    create.mutate(request.input, {
      onSuccess: (batch) => {
        const count = batch.recipientCount;
        toast.success(
          batch.scheduledAt
            ? t("CSKH:Send:Scheduled", count, request.channelName, formatDateTime(batch.scheduledAt))
            : t("CSKH:Send:Sent", count, request.channelName),
        );
        setRequest(null);
        onSent();
      },
    });
  };

  const sendTest = (input: SendPreviewInput) =>
    test.mutate(input, { onSuccess: ({ phone }) => toast.success(t("CSKH:Send:TestSent", phone)) });

  return {
    request,
    ask: setRequest,
    close: () => setRequest(null),
    confirm,
    sending: create.isPending,
    sendTest,
    testing: test.isPending,
  };
}

export type SendSubmit = ReturnType<typeof useSendSubmit>;
