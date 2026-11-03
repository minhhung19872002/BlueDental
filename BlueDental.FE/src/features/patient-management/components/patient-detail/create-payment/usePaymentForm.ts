import { cashierDiscountOf } from "./paymentRounds";
import { roundMoney } from "./paymentRoundMoney";
import { usePaymentFields, type PaymentFieldOptions } from "./usePaymentFields";
import { usePaymentRounds } from "./usePaymentRounds";
import { useRoundTerms } from "./useRoundTerms";
import { useRoundVoucher } from "./useRoundVoucher";

export { ISO_DAY, type PaymentFormState, type SplitMode } from "./usePaymentFields";

interface Options extends PaymentFieldOptions {
  patientId: string;
  branchId: string;
  heldForPatient: number;
}

/**
 * The dialog's figures and everything worked out from them (P2910): the
 * ticks and typed fields, each card's đợt terms, the slip's earlier đợt, the
 * payment-time voucher and the money they come to.
 */
export function usePaymentForm(options: Options) {
  const { open, patientId, branchId, revision, focusServiceId, heldForPatient } = options;
  const fields = usePaymentFields(options);
  const terms = useRoundTerms(open, revision, focusServiceId);
  const rounds = usePaymentRounds({ open, patientId, branchId, slip: fields.slip, revision });

  const { chosen, form } = fields;
  const discounts = new Map(chosen.map((line) => [line.id, cashierDiscountOf(terms.appliedOf(line.id), line)]));
  const voucher = useRoundVoucher({ open, branchId, revision, chosen, discounts, alongside: rounds.alongside });
  const money = roundMoney({ chosen, discounts, voucher: voucher.price, form, heldForPatient });

  return {
    ...fields,
    terms,
    rounds,
    voucher,
    money,
    /** Ticking a card opens its đợt terms; unticking folds them. */
    toggle: (id: string, on: boolean) => {
      fields.pick(id, on);
      terms.expand(id, on);
    },
    /** Ticking everything leaves the cards folded. */
    toggleAll: (on: boolean) => {
      fields.pickAll(on);
      if (!on) terms.foldAll();
    },
  };
}

export type PaymentForm = ReturnType<typeof usePaymentForm>;
