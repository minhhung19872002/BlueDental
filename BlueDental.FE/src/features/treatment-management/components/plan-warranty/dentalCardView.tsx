import type { TableColumnsType } from "antd";
import dayjs from "dayjs";
import { StatusBadge } from "@/components/StatusBadge";
import { WarrantyCardPhotos, type WarrantyCardUrls } from "@/components/WarrantyCardPhotos";
import {
  formatCardDate,
  LABO_WARRANTY_STATE_PILL,
  remainingLabel,
  type LaboWarrantyState,
} from "@/features/labo/components/warranty/laboWarrantyRules";
import type { WarrantyFace } from "@/features/labo/components/warranty/WarrantyCardFace";
import { t } from "@/lib/i18n";
import type { WarrantyCardRowDto } from "../../api/planWarrantyApi";
import { cardLife } from "./planWarrantyView";
import { cardDurationText } from "./warrantyEventText";

/** A dental card is issued activated: only Còn hiệu lực or Hết hạn, read against the clinic's day. */
function cardState(card: WarrantyCardRowDto, today: string): LaboWarrantyState {
  return cardLife(card, today).expired ? "expired" : "active";
}

function leftText(card: WarrantyCardRowDto, today: string): string {
  const left = remainingLabel(card.endDate, dayjs(today));
  return t(left.key, ...left.args);
}

function photoUrls(card: WarrantyCardRowDto): WarrantyCardUrls {
  return Object.fromEntries(card.photos.map((photo) => [photo.side, photo.url]));
}

/** "Răng 24", or the service itself on a line without teeth. */
function cardHeading(card: WarrantyCardRowDto): string {
  return card.toothNumber != null ? t("Labo:Check:ToothLabel", card.toothNumber) : card.serviceName;
}

/** The card face of Labo's step 3, worded for a dental card (R-1120). */
export function dentalCardFace(card: WarrantyCardRowDto, today: string): WarrantyFace {
  return {
    heading: cardHeading(card),
    code: card.code,
    what: [card.serviceName, cardDurationText(card)].filter(Boolean).join(" · "),
    startDate: card.startDate,
    endDate: card.endDate,
    state: cardState(card, today),
    elapsed: cardLife(card, today).elapsed,
    left: leftText(card, today),
    note: card.dentistName ? t("Treatment:Warranty:Dentist", card.dentistName) : "",
  };
}

/** Răng · Mã thẻ · Bắt đầu · Hết hạn · Thời hạn · Còn lại · Điều kiện · Ảnh thẻ · Trạng thái. */
export function dentalCardColumns(today: string): TableColumnsType<WarrantyCardRowDto> {
  return [
    {
      title: t("Labo:Warranty:Table:Tooth"),
      key: "tooth",
      width: 64,
      render: (_, card) => card.toothNumber ?? formatCardDate(null),
    },
    {
      title: t("Labo:Warranty:Table:Code"),
      key: "code",
      width: 190,
      render: (_, card) => <span className="pd-labo-warranty-code">{card.code}</span>,
    },
    { title: t("Labo:Warranty:Table:Start"), key: "start", width: 92, render: (_, card) => formatCardDate(card.startDate) },
    { title: t("Labo:Warranty:Table:End"), key: "end", width: 92, render: (_, card) => formatCardDate(card.endDate) },
    { title: t("Labo:Warranty:Duration"), key: "duration", width: 120, render: (_, card) => cardDurationText(card) },
    { title: t("Labo:Warranty:Table:Left"), key: "left", width: 120, render: (_, card) => leftText(card, today) },
    {
      title: t("Labo:Warranty:Conditions"),
      key: "conditions",
      width: 200,
      render: (_, card) => card.conditions || formatCardDate(null),
    },
    {
      title: t("Labo:Warranty:Table:Photos"),
      key: "photos",
      width: 116,
      render: (_, card) =>
        card.photos.length > 0 ? <WarrantyCardPhotos urls={photoUrls(card)} compact /> : formatCardDate(null),
    },
    {
      title: t("Labo:Warranty:Table:State"),
      key: "state",
      width: 116,
      render: (_, card) => {
        const pill = LABO_WARRANTY_STATE_PILL[cardState(card, today)];
        return <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />;
      },
    },
  ];
}
