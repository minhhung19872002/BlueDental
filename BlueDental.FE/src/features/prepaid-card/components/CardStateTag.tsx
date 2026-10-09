import { Tag } from "antd";
import { t } from "@/lib/i18n";
import { CARD_STATE, CARD_STATUS, type CardDto, type CardState } from "../types";

/** Labels and colours of the states the list shows and filters by. */
export const cardStateConfig = (): Record<CardState, { label: string; color: string }> => ({
  [CARD_STATE.Usable]: { label: t("PrepaidCard:State:Usable"), color: "green" },
  [CARD_STATE.Locked]: { label: t("PrepaidCard:State:Locked"), color: "red" },
  [CARD_STATE.Exhausted]: { label: t("PrepaidCard:State:Exhausted"), color: "default" },
  [CARD_STATE.Expired]: { label: t("PrepaidCard:State:Expired"), color: "orange" },
  [CARD_STATE.Cancelled]: { label: t("PrepaidCard:State:Cancelled"), color: "default" },
});

type StateFields = Pick<CardDto, "status" | "isExhausted" | "isExpired">;

/** Cancelled, then expired, then locked; otherwise no value or no use left reads "Hết giá trị". */
export function cardStateOf(card: StateFields): CardState {
  if (card.status === CARD_STATUS.Cancelled) return CARD_STATE.Cancelled;
  if (card.isExpired) return CARD_STATE.Expired;
  if (card.status === CARD_STATUS.Locked) return CARD_STATE.Locked;
  return card.isExhausted ? CARD_STATE.Exhausted : CARD_STATE.Usable;
}

export function CardStateTag({ card }: { card: StateFields }) {
  const { label, color } = cardStateConfig()[cardStateOf(card)];
  return <Tag color={color}>{label}</Tag>;
}
