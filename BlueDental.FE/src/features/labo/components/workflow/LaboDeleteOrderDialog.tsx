import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import { laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { useDeleteLaboOrder } from "@/features/labo/api/laboMutations";

interface Props {
  /** The Nháp asked about; null keeps the confirm closed. */
  order: LaboOrderDto | null;
  onClose: () => void;
}

/** The bin on a Nháp row: gone for good once confirmed, its code never handed out again. */
export function LaboDeleteOrderDialog({ order, onClose }: Props) {
  const remove = useDeleteLaboOrder();

  const handleConfirm = async () => {
    if (!order) return;
    try {
      await remove.mutateAsync(order.id);
      toast.success(t("Labo:Workflow:Deleted"));
      onClose();
    } catch {
      // The global MutationCache toasts the server's message.
    }
  };

  return (
    <ConfirmDialog
      open={order !== null}
      message={t("Labo:Workflow:DeleteConfirm", order ? laboOrderNo(order) : "")}
      pending={remove.isPending}
      onConfirm={() => void handleConfirm()}
      onClose={onClose}
    />
  );
}
