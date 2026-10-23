import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  useClaimConversation,
  useReleaseConversation,
  useTransferConversation,
} from "../api/inboxApi";

/**
 * "Nhận xử lý", "Nhả hội thoại" and "Chuyển cho người khác" of one
 * conversation. A refusal (someone else took it first) reaches the user as the
 * mutation cache's toast; the polled header then shows who holds it.
 */
export function useHoldActions(id: string) {
  const claim = useClaimConversation();
  const release = useReleaseConversation();
  const transfer = useTransferConversation();

  return {
    claim: () => claim.mutate(id),
    release: () => release.mutate(id, { onSuccess: () => toast.success(t("CSKH:Inbox:Released")) }),
    transfer: (userId: string, name: string, onDone: () => void) =>
      transfer.mutate(
        { id, userId },
        {
          onSuccess: () => {
            toast.success(t("CSKH:Inbox:Transferred", name));
            onDone();
          },
        },
      ),
    claiming: claim.isPending,
    releasing: release.isPending,
    transferring: transfer.isPending,
  };
}

export type HoldActions = ReturnType<typeof useHoldActions>;
