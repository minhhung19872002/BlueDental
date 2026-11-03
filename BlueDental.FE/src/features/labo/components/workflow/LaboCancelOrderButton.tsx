import { useState } from "react";
import { Button } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";
import { LABO_STATUS, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { useCancelLaboOrder } from "@/features/labo/api/laboMutations";

/** Hủy phiếu reaches Đã hủy from these; once something came back for checking the order runs its course. */
const CANCELLABLE = new Set<number>([LABO_STATUS.Draft, LABO_STATUS.Sent, LABO_STATUS.AwaitingCheck]);

interface Props {
  order: LaboOrderDto | undefined;
  disabled?: boolean;
  onDone: () => void;
}

/**
 * "Hủy phiếu" in the footer of the Đặt hàng and Nhận hàng & kiểm tra tabs,
 * behind a confirm. The order keeps its row as Đã hủy.
 */
export function LaboCancelOrderButton({ order, disabled, onDone }: Props) {
  const ability = useAbility("treatmentLabo");
  const cancel = useCancelLaboOrder();
  const [asking, setAsking] = useState(false);

  if (!order || !ability.canUpdate || !CANCELLABLE.has(order.status)) return null;

  const handleConfirm = async () => {
    try {
      await cancel.mutateAsync(order.id);
      setAsking(false);
      toast.success(t("Labo:Workflow:Cancelled"));
      onDone();
    } catch {
      // The global MutationCache toasts the server's message.
    }
  };

  return (
    <>
      <Button danger icon={<CloseCircleOutlined />} disabled={disabled} onClick={() => setAsking(true)}>
        {t("Labo:Workflow:CancelOrder")}
      </Button>
      <ConfirmDialog
        open={asking}
        message={t("Labo:Workflow:CancelConfirm", order.orderCode)}
        pending={cancel.isPending}
        onConfirm={() => void handleConfirm()}
        onClose={() => setAsking(false)}
      />
    </>
  );
}
