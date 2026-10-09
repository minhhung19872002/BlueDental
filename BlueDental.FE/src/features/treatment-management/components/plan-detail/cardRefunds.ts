import { PAYMENT_METHOD, type PatientPaymentDto } from "../../api/treatmentPlanApi";

/** What one Thẻ trả trước still holds on each line of a slip: paid by it, less refunded to it. */
export interface CardOnSlip {
  cardId: string;
  code: string;
  byLine: Map<string, number>;
}

/**
 * The cards that paid this slip, from its collected payments and refunds.
 * Money a card paid can only go back onto that card, so the refund dialog
 * offers each of these as a channel, capped line by line (the server checks
 * the same rule).
 */
export function cardsOnSlip(payments: PatientPaymentDto[], refunds: PatientPaymentDto[]): CardOnSlip[] {
  const cards = new Map<string, CardOnSlip>();
  const add = (receipt: PatientPaymentDto, sign: 1 | -1) => {
    if (receipt.method !== PAYMENT_METHOD.PrepaidCard || !receipt.prepaidCardId) return;
    const card = cards.get(receipt.prepaidCardId) ?? {
      cardId: receipt.prepaidCardId,
      code: receipt.prepaidCardCode ?? "—",
      byLine: new Map<string, number>(),
    };
    for (const line of receipt.lines) {
      card.byLine.set(line.treatmentServiceId, (card.byLine.get(line.treatmentServiceId) ?? 0) + sign * line.amount);
    }
    cards.set(card.cardId, card);
  };
  payments.forEach((payment) => add(payment, 1));
  refunds.forEach((refund) => add(refund, -1));
  return [...cards.values()].filter((card) => [...card.byLine.values()].some((amount) => amount > 0));
}

/** What every card together still holds on one line — the part a cash refund may not touch. */
export function cardHeldOnLine(cards: CardOnSlip[], lineId: string): number {
  return cards.reduce((sum, card) => sum + Math.max(0, card.byLine.get(lineId) ?? 0), 0);
}
