import { Button } from "antd";
import { CloseCircleOutlined, LockOutlined, PlusCircleOutlined, UnlockOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { CARD_STATUS, TRANSACTION_TYPE, type CardDetailDto } from "../types";

export interface CardDetailActions {
  onTopup?: (card: CardDetailDto) => void;
  onToggleLock?: (card: CardDetailDto) => void;
  onSaveMembers?: (card: CardDetailDto, memberPatientIds: string[]) => void;
  onCancel?: (card: CardDetailDto) => void;
  savingMembers: boolean;
  togglingLock: boolean;
}

interface Props {
  card: CardDetailDto | undefined;
  actions: CardDetailActions;
  onClose: () => void;
}

/**
 * The card dialog's footer: "Huỷ thẻ" on the left, apart from the everyday
 * actions; "Khoá / Mở khoá", "Nạp thêm" and "Đóng" on the right. A cancelled
 * card offers only "Đóng".
 */
export function CardDetailFooter({ card, actions, onClose }: Props) {
  const locked = card?.status === CARD_STATUS.Locked;
  const live = card !== undefined && card.status !== CARD_STATUS.Cancelled;
  // Huỷ thẻ undoes a mistaken sale — never a card that has paid for a service.
  const neverUsed = card?.transactions.every((tx) => tx.type !== TRANSACTION_TYPE.Use) ?? false;

  return (
    <div className="prepaid-detail-foot">
      <span>
        {live && actions.onCancel && neverUsed ? (
          <Button danger icon={<CloseCircleOutlined />} onClick={() => actions.onCancel?.(card)}>
            {t("PrepaidCard:Cancel:Action")}
          </Button>
        ) : null}
      </span>
      <span className="prepaid-detail-foot__main">
        {live && actions.onToggleLock ? (
          <Button
            icon={locked ? <UnlockOutlined /> : <LockOutlined />}
            loading={actions.togglingLock}
            disabled={actions.togglingLock}
            onClick={() => actions.onToggleLock?.(card)}
          >
            {t(locked ? "PrepaidCard:Unlock" : "PrepaidCard:Lock")}
          </Button>
        ) : null}
        {live && actions.onTopup && !locked && !card.isExpired ? (
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => actions.onTopup?.(card)}>
            {t("PrepaidCard:Topup:Action")}
          </Button>
        ) : null}
        <Button onClick={onClose}>{t("Common:Close")}</Button>
      </span>
    </div>
  );
}
