import type { ReactNode } from "react";
import { durationLabel } from "@/features/labo/components/warranty/laboWarrantyRules";
import { t, tRich } from "@/lib/i18n";
import {
  WARRANTY_EVENT_KIND,
  WARRANTY_EVENT_SOURCE,
  type WarrantyCardRowDto,
  type WarrantyEventDto,
  type WarrantyEventKind,
  type WarrantyEventSource,
} from "../../api/planWarrantyApi";
import { teethText } from "./planWarrantyView";

export const EVENT_SOURCE: Record<WarrantyEventSource, { label: string; tone: string }> = {
  [WARRANTY_EVENT_SOURCE.Labo]: { label: "Treatment:Warranty:Kind:Labo", tone: "labo" },
  [WARRANTY_EVENT_SOURCE.Dental]: { label: "Treatment:Warranty:Kind:Dental", tone: "dental" },
  [WARRANTY_EVENT_SOURCE.Treatment]: { label: "Treatment:Warranty:Source:Treatment", tone: "treatment" },
};

/** "BH-2611-0291-11, -21": the first card in full, the next ones by their own tail when they share its stem. */
export function compactCodes(codes: readonly string[]): string {
  const [first, ...rest] = codes;
  if (!first) return "";
  const stem = first.slice(0, first.lastIndexOf("-") + 1);
  const tails = rest.map((code) => (stem && code.startsWith(stem) ? `-${code.slice(stem.length)}` : code));
  return [first, ...tails].join(", ");
}

const strong = (text: string) => <strong>{text}</strong>;

const TITLES: Record<WarrantyEventKind, (event: WarrantyEventDto) => ReactNode> = {
  [WARRANTY_EVENT_KIND.LaboPassed]: (event) => tRich("Treatment:Warranty:Event:LaboPassed", strong(event.laboOrderCode ?? "")),
  [WARRANTY_EVENT_KIND.LaboReturned]: (event) =>
    tRich("Treatment:Warranty:Event:LaboReturned", strong(event.laboOrderCode ?? "")),
  [WARRANTY_EVENT_KIND.LaboActivated]: (event) => activated(event),
  [WARRANTY_EVENT_KIND.DentalActivated]: (event) => activated(event),
  [WARRANTY_EVENT_KIND.RequestOpened]: (event) =>
    withService(t("Treatment:Warranty:Event:RequestOpened", event.stageName ?? ""), event),
  [WARRANTY_EVENT_KIND.RequestDone]: (event) =>
    withService(t("Treatment:Warranty:Event:RequestDone", event.stageName ?? ""), event),
};

function withService(head: ReactNode, event: WarrantyEventDto): ReactNode {
  return (
    <>
      {head}
      {` · ${event.serviceName}`}
    </>
  );
}

function activated(event: WarrantyEventDto): ReactNode {
  const head = tRich("Treatment:Warranty:Event:Activated", event.cardCodes.length, strong(compactCodes(event.cardCodes)));
  return withService(head, event);
}

/** The bold line of one event (m371), from its real data. */
export function eventTitle(event: WarrantyEventDto): ReactNode {
  return TITLES[event.kind](event);
}

/** "6 tháng" / "5 năm" as the duration chips read it, or "30 ngày" on a card that follows the catalog. */
export function cardDurationText(card: Pick<WarrantyCardRowDto, "durationMonths" | "durationDays">): string {
  if (card.durationMonths) {
    const label = durationLabel(card.durationMonths);
    return t(label.key, label.value);
  }
  return card.durationDays ? t("Treatment:Warranty:Days", card.durationDays) : "";
}

const ACTIVATIONS: readonly WarrantyEventKind[] = [WARRANTY_EVENT_KIND.LaboActivated, WARRANTY_EVENT_KIND.DentalActivated];
const LABO_RECEIPTS: readonly WarrantyEventKind[] = [WARRANTY_EVENT_KIND.LaboPassed, WARRANTY_EVENT_KIND.LaboReturned];

/**
 * The grey line under it (m371): the dentist and the period of an activation,
 * the service of a Labo receipt, else the teeth and who did it.
 */
export function eventSubline(event: WarrantyEventDto, cards: readonly WarrantyCardRowDto[]): string {
  const teeth = event.teeth.length > 0 ? teethText(event.teeth) : null;
  const card = ACTIVATIONS.includes(event.kind) ? cards.find((one) => event.cardCodes.includes(one.code)) : undefined;
  if (card) {
    const dentist = card.dentistName && t("Treatment:Warranty:Dentist", card.dentistName);
    return [dentist, cardDurationText(card)].filter(Boolean).join(" · ");
  }
  const parts = LABO_RECEIPTS.includes(event.kind) ? [event.serviceName, teeth] : [teeth, event.staffName];
  return parts.filter(Boolean).join(" · ");
}
