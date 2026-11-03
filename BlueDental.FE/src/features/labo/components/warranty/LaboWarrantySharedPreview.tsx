import { t } from "@/lib/i18n";
import { durationLabel, warrantyEndDate } from "./laboWarrantyRules";
import { isWarrantyCardReady, type LaboWarrantyCardValues } from "./useLaboWarrantyForm";
import { WarrantyCardFace, type WarrantyFace } from "./WarrantyCardFace";

/** Up to this many teeth show as chips in the card's head; more, and it shows none (BA). */
const HEAD_CHIPS = 3;
/** Sheets drawn behind the card, so it reads as several cards in one. */
const MAX_SHEETS = 2;

interface Props {
  teeth: number[];
  /** The shared card as typed so far. */
  card: LaboWarrantyCardValues | undefined;
  /** "Sứ · Việt Tiến Lab Group". */
  what: string;
  /** The clinic's logo, as the header shows it. */
  logoUrl: string;
}

/**
 * Xem trước thẻ bảo hành under Dùng chung (BA mock): one card for the picked
 * teeth with the validity typed so far, then every tooth it covers. The head
 * names its teeth only while they are three at most — never a cut-off few —
 * the list below names them all. Each tooth still gets its own code on
 * activation, so the card names none.
 */
export function LaboWarrantySharedPreview({ teeth, card, what, logoUrl }: Props) {
  const ready = isWarrantyCardReady(card);
  const duration = card?.months ? durationLabel(card.months) : null;
  const face: WarrantyFace = {
    heading:
      teeth.length <= HEAD_CHIPS ? (
        <span className="pd-labo-warranty-card-teeth">
          {teeth.map((tooth) => (
            <span key={tooth} className="pd-labo-warranty-card-tooth">
              {t("Labo:Warranty:ToothShort", tooth)}
            </span>
          ))}
        </span>
      ) : null,
    code: t("Labo:Warranty:SharedCode"),
    what,
    startDate: card?.startDate?.format("YYYY-MM-DD"),
    endDate: warrantyEndDate(card?.startDate, card?.months)?.format("YYYY-MM-DD"),
    state: ready ? "active" : "inactive",
    elapsed: 0,
    left: duration ? t(duration.key, duration.value) : t("Labo:Warranty:NotEntered"),
    note: t("Labo:Warranty:NoClaimsYet"),
    pill: ready ? t("Labo:Warranty:ReadyTeeth", teeth.length) : undefined,
  };

  return (
    <div className="pd-labo-warranty-preview">
      <h4 className="pd-labo-warranty-preview-title">{t("Labo:Warranty:Preview")}</h4>
      {/* Stacked like a deck (BA mock): one sheet behind per extra tooth, two at most. */}
      <div className={`pd-labo-warranty-stack pd-labo-warranty-stack--${Math.min(teeth.length - 1, MAX_SHEETS)}`}>
        <WarrantyCardFace face={face} logoUrl={logoUrl} />
      </div>
      <div className="pd-labo-warranty-preview-teeth">
        <span>{t("Labo:Warranty:TeethInCard", teeth.length)}</span>
        <ul>
          {teeth.map((tooth) => (
            <li key={tooth}>{t("Labo:Check:ToothLabel", tooth)}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
