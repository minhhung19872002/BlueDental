import type { CSSProperties } from "react";
import type { TableColumnsType } from "antd";
import { getLocale, t } from "@/lib/i18n";
import { formatCardDate } from "@/features/labo/components/warranty/laboWarrantyRules";
import { WARRANTY_CARD_KIND, type WarrantyCardRowDto } from "../../api/planWarrantyApi";
import { CARD_KIND_LABEL, cardLife } from "./planWarrantyView";
import { cardDurationText } from "./warrantyEventText";

/** "R36 · BS. Nguyễn Lan Chi" on a dental card, "R11 · Labo Kim Long" on a Labo one. */
function cardSubline(card: WarrantyCardRowDto): string {
  const who =
    card.kind === WARRANTY_CARD_KIND.Labo
      ? card.supplierName
      : card.dentistName && t("Treatment:Warranty:Dentist", card.dentistName);
  return [card.toothNumber != null && `R${card.toothNumber}`, who].filter(Boolean).join(" · ");
}

function LifeCell({ card, today }: { card: WarrantyCardRowDto; today: string }) {
  const life = cardLife(card, today);
  const bar = { "--pwt-elapsed": `${Math.round(life.elapsed * 100)}%` } as CSSProperties;
  return (
    <div className="pwt-life">
      <strong>
        {life.expired ? t("Treatment:Warranty:Expired") : t("Treatment:Warranty:DaysLeft", life.daysLeft.toLocaleString(getLocale()))}
      </strong>
      <span className="pwt-life-bar" style={bar} aria-hidden="true" />
    </div>
  );
}

export function activatedCardColumns(today: string, onHistory: (code: string) => void): TableColumnsType<WarrantyCardRowDto> {
  return [
    {
      key: "code",
      title: t("Treatment:Warranty:Col:Code"),
      width: 200,
      render: (_, card) => (
        <div className="pwt-stack">
          <strong className="pwt-code">{card.code}</strong>
          {card.laboOrderCode && <span className="pwt-sub">{card.laboOrderCode}</span>}
        </div>
      ),
    },
    {
      key: "kind",
      title: t("Treatment:Warranty:Col:Kind"),
      width: 110,
      render: (_, card) => (
        <span className={`pwt-pill pwt-pill--${card.kind === WARRANTY_CARD_KIND.Labo ? "labo" : "active"}`}>
          {t(CARD_KIND_LABEL[card.kind])}
        </span>
      ),
    },
    {
      key: "service",
      title: t("Treatment:Warranty:Col:Service"),
      width: 240,
      render: (_, card) => (
        <div className="pwt-stack">
          <span>{card.serviceName}</span>
          <span className="pwt-sub">{cardSubline(card)}</span>
        </div>
      ),
    },
    {
      key: "period",
      title: t("Treatment:Warranty:Col:Period"),
      width: 210,
      render: (_, card) => (
        <div className="pwt-stack">
          <span>
            {formatCardDate(card.startDate)} → <strong>{formatCardDate(card.endDate)}</strong>
          </span>
          <span className="pwt-sub">{cardDurationText(card)}</span>
        </div>
      ),
    },
    { key: "life", title: t("Treatment:Warranty:Col:Left"), width: 260, render: (_, card) => <LifeCell card={card} today={today} /> },
    {
      key: "state",
      title: t("Treatment:Warranty:Col:State"),
      width: 110,
      render: (_, card) =>
        cardLife(card, today).expired ? (
          <span className="pwt-pill pwt-pill--expired">{t("Treatment:Warranty:Expired")}</span>
        ) : (
          <span className="pwt-pill pwt-pill--active">{t("Treatment:Warranty:Valid")}</span>
        ),
    },
    {
      key: "history",
      width: 110,
      align: "right",
      render: (_, card) => (
        <button type="button" className="pwt-link" onClick={() => onHistory(card.code)}>
          {t("Treatment:Warranty:History")}
        </button>
      ),
    },
  ];
}
