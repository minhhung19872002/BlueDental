import { Tag } from "antd";
import { t } from "@/lib/i18n";
import { CARD_STATE, CARD_STATUS, type CardDto, type CardState } from "../types";

/** Labels and colours of the three states the list shows and filters by. */
export const cardStateConfig = (): Record<CardState, { label: string; color: string }> => ({
  [CARD_STATE.Usable]: { label: t("PrepaidCard:State:Usable"), color: "green" },
  [CARD_STATE.Locked]: { label: t("PrepaidCard:State:Locked"), color: "red" },
  [CARD_STATE.Exhausted]: { label: t("PrepaidCard:State:Exhausted"), color: "default" },
});

/** Locked wins; otherwise a card with no value or no use left reads "Hết giá trị". */
export function cardStateOf(card: Pick<CardDto, "status" | "isExhausted">): CardState {
  if (card.status === CARD_STATUS.Locked) return CARD_STATE.Locked;
  return card.isExhausted ? CARD_STATE.Exhausted : CARD_STATE.Usable;
}

export function CardStateTag({ card }: { card: Pick<CardDto, "status" | "isExhausted"> }) {
  const { label, color } = cardStateConfig()[cardStateOf(card)];
  return <Tag color={color}>{label}</Tag>;
}
