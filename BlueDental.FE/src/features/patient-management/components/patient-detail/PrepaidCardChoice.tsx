import type { PrepaidCardOption } from "@/hooks/usePrepaidCardOptions";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";

interface Props {
  cards: PrepaidCardOption[];
  loading: boolean;
  patientId: string;
  value: string | undefined;
  onChange: (cardId: string) => void;
}

/** "N lần còn lại", or nothing for a card with no limit. */
const usesLeft = (card: PrepaidCardOption) =>
  card.remainingUses === null ? t("PrepaidCard:Unlimited") : t("PrepaidCard:Pay:UsesLeft", card.remainingUses);

/**
 * The cards the patient may pay with, under the "Thẻ trả trước" method pill:
 * one row each with its balance and uses left. The server re-checks the
 * holder, balance, uses and that every ticked service is in the card's scope.
 */
export function PrepaidCardChoice({ cards, loading, patientId, value, onChange }: Props) {
  if (loading) return <p className="pd-newpay-empty">{t("Common:Loading")}</p>;
  if (cards.length === 0) return <p className="pd-newpay-empty">{t("PrepaidCard:Pay:NoCard")}</p>;

  return (
    <div className="pd-newpay-accounts">
      <div className="pd-newpay-acchead">
        <span>{t("Patient:Payment:Select")}</span>
        <span>{t("PrepaidCard:Col:Code")}</span>
        <span>{t("PrepaidCard:Col:Balance")}</span>
      </div>
      {cards.map((card) => (
        <label className="pd-newpay-accrow" key={card.id}>
          <input
            type="radio"
            name="pd-prepaid-card"
            checked={value === card.id}
            onChange={() => onChange(card.id)}
          />
          <span className="pd-newpay-radio" />
          <span>
            {card.code} · {card.name}
            {card.ownerPatientId !== patientId ? (
              <small> ({t("PrepaidCard:Pay:SharedBy", card.ownerName ?? "—")})</small>
            ) : null}
          </span>
          <span>
            {formatMoneyUnit(card.balance)} · {usesLeft(card)}
          </span>
        </label>
      ))}
    </div>
  );
}
