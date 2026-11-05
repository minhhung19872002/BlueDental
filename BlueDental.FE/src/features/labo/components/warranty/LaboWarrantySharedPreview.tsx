import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { cardEndDate, typedDurationText } from "./laboWarrantyRules";
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
  /** A dental card's Danh mục days, for "Theo danh mục" (P3110 REQ-B5). */
  catalogDays?: number;
  /** The code line and the head's pill, when not the defaults — Labo v2's "3 thẻ · serial riêng từng răng", "1/3 sẵn sàng". */
  wording?: { code: string; pill: string };
}

/** Răng trong thẻ bảo hành (n), each picked tooth as a chip. */
export function LaboWarrantyTeethInCard({ teeth }: { teeth: number[] }) {
  return (
    <div className="pd-labo-warranty-preview-teeth">
      <span>{t("Labo:Warranty:TeethInCard", teeth.length)}</span>
      <ul>
        {teeth.map((tooth) => (
          <li key={tooth}>{t("Labo:Check:ToothLabel", tooth)}</li>
        ))}
      </ul>
    </div>
  );
}

function headChips(teeth: number[]): ReactNode {
  if (teeth.length > HEAD_CHIPS) return null;
  return (
    <span className="pd-labo-warranty-card-teeth">
      {teeth.map((tooth) => (
        <span key={tooth} className="pd-labo-warranty-card-tooth">
          {t("Labo:Warranty:ToothShort", tooth)}
        </span>
      ))}
    </span>
  );
}

/**
 * Xem trước thẻ bảo hành under Dùng chung (BA mock): one card for the picked
 * teeth with the validity typed so far, then every tooth it covers. The head
 * names its teeth only while they are three at most — never a cut-off few —
 * the list below names them all. Each tooth still gets its own code on
 * activation, so the card names none.
 */
export function LaboWarrantySharedPreview({ teeth, card, what, logoUrl, catalogDays, wording }: Props) {
  const ready = isWarrantyCardReady(card);
  const face: WarrantyFace = {
    heading: headChips(teeth),
    code: wording?.code ?? t("Labo:Warranty:SharedCode"),
    what,
    startDate: card?.startDate?.format("YYYY-MM-DD"),
    endDate: cardEndDate(card, catalogDays)?.format("YYYY-MM-DD"),
    state: ready ? "active" : "inactive",
    elapsed: 0,
    left: typedDurationText(card?.months, catalogDays),
    note: t("Labo:Warranty:NoClaimsYet"),
    pill: wording?.pill ?? (ready ? t("Labo:Warranty:ReadyTeeth", teeth.length) : undefined),
  };

  return (
    <div className="pd-labo-warranty-preview">
      <h4 className="pd-labo-warranty-preview-title">{t("Labo:Warranty:Preview")}</h4>
      {/* Stacked like a deck (BA mock): one sheet behind per extra tooth, two at most. */}
      <div className={`pd-labo-warranty-stack pd-labo-warranty-stack--${Math.min(teeth.length - 1, MAX_SHEETS)}`}>
        <WarrantyCardFace face={face} logoUrl={logoUrl} />
      </div>
      <LaboWarrantyTeethInCard teeth={teeth} />
    </div>
  );
}
