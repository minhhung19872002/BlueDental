import type { CSSProperties, ReactNode } from "react";
import { t } from "@/lib/i18n";
import { formatCardDate, LABO_WARRANTY_STATE_PILL, type LaboWarrantyState } from "./laboWarrantyRules";

/** What one warranty card prints, already worded — a Labo tooth's or a dental card's. */
export interface WarrantyFace {
  /** "Răng 24", the service of a line without teeth, or the shared card's tooth chips. */
  heading: ReactNode;
  code: string;
  /** "Sứ Zirconia · 5 năm". */
  what: string;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  state: LaboWarrantyState;
  /** 0..1 of its life gone — the bar. */
  elapsed: number;
  /** "Còn 4 năm 11 tháng". */
  left: string;
  /** The foot's right: "Chưa bảo hành lần nào", the dentist, … */
  note: string;
  /** The head's pill, when not the state's own — "3 sẵn sàng" on the shared preview. */
  pill?: string;
}

interface Props {
  face: WarrantyFace;
  /** The clinic's logo, as the header shows it. */
  logoUrl: string;
  /** The card "Xem chi tiết" was pressed on (R-1120). */
  focused?: boolean;
  /** A control in the foot's right, over the note — Tổng quan's "Chỉnh sửa" (R-1152). */
  footAction?: ReactNode;
}

/**
 * One warranty card: purple once activated, grey before, red-edged once run
 * out, with its code, validity and time left.
 */
export function WarrantyCardFace({ face, logoUrl, focused, footAction }: Props) {
  const pill = LABO_WARRANTY_STATE_PILL[face.state];
  const elapsed = { "--pd-warranty-elapsed": `${Math.round(face.elapsed * 100)}%` } as CSSProperties;
  const className = [
    "pd-labo-warranty-card",
    `pd-labo-warranty-card--${face.state}`,
    focused && "pd-labo-warranty-card--focus",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={className}
      aria-label={t("Labo:Warranty:CardCode", face.code)}
      aria-current={focused || undefined}
    >
      <span className="pd-labo-warranty-card-head">
        <img src={logoUrl} alt="" className="pd-labo-warranty-logo" />
        <strong>{face.heading}</strong>
        {/* Tinted from the card's own text colour, so it reads on slate, purple and red. */}
        <span className="pd-labo-warranty-card-pill">{face.pill ?? t(pill.label)}</span>
      </span>
      <span className="pd-labo-warranty-card-code">{t("Labo:Warranty:CardCode", face.code)}</span>
      <span className="pd-labo-warranty-card-what">{face.what}</span>
      <span>{t("Labo:Warranty:Validity", formatCardDate(face.startDate), formatCardDate(face.endDate))}</span>
      <span className="pd-labo-warranty-card-bar" style={elapsed} />
      <span className="pd-labo-warranty-card-foot">
        <span>{face.left}</span>
        {footAction ?? <span>{face.note}</span>}
      </span>
    </article>
  );
}
