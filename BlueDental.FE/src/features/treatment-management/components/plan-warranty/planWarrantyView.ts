import dayjs from "dayjs";
import { teethCaption } from "@/components/ToothChart";
import {
  WARRANTY_CARD_KIND,
  WARRANTY_EVENT_KIND,
  WARRANTY_EVENT_SOURCE,
  WARRANTY_ROW_GROUP,
  type WarrantyCardKind,
  type WarrantyCardRowDto,
  type WarrantyEventDto,
  type WarrantyEventKind,
  type WarrantyRowGroup,
  type WarrantyServiceRowDto,
} from "../../api/planWarrantyApi";

/** "R24" / "R11, R21" — the teeth as the mock writes them; a whole jaw by its name (R-1098). */
export function teethText(teeth: readonly number[]): string {
  return teethCaption(teeth, (tooth) => `R${tooth}`);
}

/** "Bọc sứ Emax - R24": the line's name with its teeth, if it has any. */
export function serviceTitle(row: Pick<WarrantyServiceRowDto, "serviceName" | "teeth">): string {
  return row.teeth.length > 0 ? `${row.serviceName} - ${teethText(row.teeth)}` : row.serviceName;
}

/* ── Tình trạng bảo hành theo dịch vụ: the four chips ── */

export type RowFilter = "all" | WarrantyRowGroup;

export const ROW_FILTERS: { key: RowFilter; label: string; dot?: boolean }[] = [
  { key: "all", label: "Treatment:Warranty:Filter:All" },
  { key: WARRANTY_ROW_GROUP.Ready, label: "Treatment:Warranty:Filter:Ready", dot: true },
  { key: WARRANTY_ROW_GROUP.Activated, label: "Treatment:Warranty:Filter:Activated" },
  { key: WARRANTY_ROW_GROUP.NotEligible, label: "Treatment:Warranty:Filter:NotEligible" },
];

export function countRows(rows: readonly WarrantyServiceRowDto[], filter: RowFilter): number {
  return filter === "all" ? rows.length : rows.filter((row) => row.group === filter).length;
}

export function filterRows(rows: WarrantyServiceRowDto[], filter: RowFilter): WarrantyServiceRowDto[] {
  return filter === "all" ? rows : rows.filter((row) => row.group === filter);
}

/* ── Phiếu bảo hành đã kích hoạt ── */

export type CardKindFilter = "all" | WarrantyCardKind;

export const CARD_FILTERS: { key: CardKindFilter; label: string; tone?: "dental" | "labo" }[] = [
  { key: "all", label: "Treatment:Warranty:Filter:All" },
  { key: WARRANTY_CARD_KIND.Dental, label: "Treatment:Warranty:Kind:Dental", tone: "dental" },
  { key: WARRANTY_CARD_KIND.Labo, label: "Treatment:Warranty:Kind:Labo", tone: "labo" },
];

export type CardSort = "expiry" | "activated";

export const CARD_SORTS: { key: CardSort; label: string }[] = [
  { key: "expiry", label: "Treatment:Warranty:Sort:Expiry" },
  { key: "activated", label: "Treatment:Warranty:Sort:Activated" },
];

export const CARD_KIND_LABEL: Record<WarrantyCardKind, string> = {
  [WARRANTY_CARD_KIND.Dental]: "Treatment:Warranty:Kind:Dental",
  [WARRANTY_CARD_KIND.Labo]: "Treatment:Warranty:Kind:Labo",
};

export interface CardView {
  kind: CardKindFilter;
  /** "Xem thẻ ›" of one line narrows the list to its cards. */
  lineId: string | null;
  sort: CardSort;
}

export function countCards(cards: readonly WarrantyCardRowDto[], kind: CardKindFilter): number {
  return kind === "all" ? cards.length : cards.filter((card) => card.kind === kind).length;
}

const SORTERS: Record<CardSort, (a: WarrantyCardRowDto, b: WarrantyCardRowDto) => number> = {
  expiry: (a, b) => a.endDate.localeCompare(b.endDate) || a.code.localeCompare(b.code),
  activated: (a, b) => b.activatedAt.localeCompare(a.activatedAt) || a.code.localeCompare(b.code),
};

export function visibleCards(cards: WarrantyCardRowDto[], view: CardView): WarrantyCardRowDto[] {
  return cards
    .filter((card) => view.kind === "all" || card.kind === view.kind)
    .filter((card) => !view.lineId || card.lineId === view.lineId)
    .sort(SORTERS[view.sort]);
}

/** Thời gian còn lại of one card, read against the clinic's day. */
export interface CardLife {
  daysLeft: number;
  expired: boolean;
  /** 0..1 of its life gone — the green part of the bar. */
  elapsed: number;
}

export function cardLife(card: Pick<WarrantyCardRowDto, "startDate" | "endDate">, today: string): CardLife {
  const day = dayjs(today);
  const start = dayjs(card.startDate);
  const end = dayjs(card.endDate);
  const total = end.diff(start, "day");
  const elapsed = total <= 0 ? 1 : Math.min(1, Math.max(0, day.diff(start, "day") / total));
  return { daysLeft: Math.max(0, end.diff(day, "day")), expired: end.isBefore(day, "day"), elapsed };
}

/* ── Lịch sử bảo hành ── */

export type HistoryFilter = "all" | "activation" | "request" | "labo";

const ACTIVATIONS: readonly WarrantyEventKind[] = [WARRANTY_EVENT_KIND.LaboActivated, WARRANTY_EVENT_KIND.DentalActivated];
const REQUESTS: readonly WarrantyEventKind[] = [WARRANTY_EVENT_KIND.RequestOpened, WARRANTY_EVENT_KIND.RequestDone];

const HISTORY_MATCH: Record<HistoryFilter, (event: WarrantyEventDto) => boolean> = {
  all: () => true,
  activation: (event) => ACTIVATIONS.includes(event.kind),
  request: (event) => REQUESTS.includes(event.kind),
  labo: (event) => event.source === WARRANTY_EVENT_SOURCE.Labo,
};

export const HISTORY_FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: "all", label: "Treatment:Warranty:Filter:All" },
  { key: "activation", label: "Treatment:Warranty:History:Filter:Activation" },
  { key: "request", label: "Treatment:Warranty:History:Filter:Request" },
  { key: "labo", label: "Treatment:Warranty:Kind:Labo" },
];

export interface HistoryDay {
  /** `YYYY-MM-DD` in the viewer's time. */
  day: string;
  events: WarrantyEventDto[];
}

/** Newest first as the server sends them, grouped by day, after the chip and the card picked by "Lịch sử ↓". */
export function historyDays(events: WarrantyEventDto[], filter: HistoryFilter, cardCode: string | null): HistoryDay[] {
  const days: HistoryDay[] = [];
  for (const event of events) {
    if (!HISTORY_MATCH[filter](event)) continue;
    if (cardCode && !event.cardCodes.includes(cardCode)) continue;
    const day = dayjs(event.at).format("YYYY-MM-DD");
    const last = days.at(-1);
    if (last?.day === day) last.events.push(event);
    else days.push({ day, events: [event] });
  }
  return days;
}
