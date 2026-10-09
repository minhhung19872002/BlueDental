import { Link } from "react-router-dom";
import { IdcardOutlined } from "@ant-design/icons";
import { useAbility } from "@/hooks/useAbility";
import { usePatientPrepaidCards, type PatientPrepaidCard } from "@/hooks/usePrepaidCardOptions";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";

const LOCKED = 2;
const CANCELLED = 3;

/** Why a card cannot be spent right now, or nothing when it can. */
function blockedLabel(card: PatientPrepaidCard): string | null {
  if (card.status === CANCELLED) return t("PrepaidCard:State:Cancelled");
  if (card.isExpired) return t("PrepaidCard:State:Expired");
  if (card.status === LOCKED) return t("PrepaidCard:State:Locked");
  if (card.isExhausted) return t("PrepaidCard:State:Exhausted");
  return null;
}

/**
 * "Thẻ trả trước" on the patient record: the cards the patient owns or shares,
 * with balance and uses left. Each opens the card list searched by its number.
 * Hidden without prepaidCard.read or when the patient has no card.
 */
export function PatientPrepaidCards({ patientId }: { patientId: string }) {
  const { canRead } = useAbility("prepaidCard");
  const { data: cards = [] } = usePatientPrepaidCards(patientId, canRead);
  if (cards.length === 0) return null;

  return (
    <div className="pd-cards" aria-label={t("PrepaidCard:PageTitle")}>
      <span className="pd-cards__title">
        <IdcardOutlined /> {t("PrepaidCard:PageTitle")}
      </span>
      {cards.map((card) => {
        const blocked = blockedLabel(card);
        return (
          <Link
            key={card.id}
            to={`/prepaid-card?q=${encodeURIComponent(card.code)}`}
            className={blocked ? "pd-card-chip pd-card-chip--off" : "pd-card-chip"}
          >
            <b>{card.code}</b>
            <span>{card.name}</span>
            <strong>{formatMoneyUnit(card.balance)}</strong>
            <small>{blocked ?? (card.remainingUses === null ? t("PrepaidCard:Unlimited") : t("PrepaidCard:Pay:UsesLeft", card.remainingUses))}</small>
            {card.ownerPatientId !== patientId ? (
              <small>{t("PrepaidCard:Pay:SharedBy", card.ownerName ?? "—")}</small>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
