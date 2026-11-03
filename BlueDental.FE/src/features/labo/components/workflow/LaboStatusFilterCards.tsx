import { t } from "@/lib/i18n";
import {
  LABO_STATUS_FILTER,
  type LaboStatsDto,
  type LaboStatusFilter,
} from "@/features/labo/api/laboApi";

interface FilterCard {
  filter: LaboStatusFilter;
  label: string;
  tone: "blue" | "red" | "amber" | "green" | "purple" | "gray";
  stat: keyof LaboStatsDto;
}

/** The BA's six cards (P2910_03), each in its status pill's colour. */
const FILTER_CARDS: readonly FilterCard[] = [
  { filter: LABO_STATUS_FILTER.Draft, label: "Patient:Labo:Status:Draft", tone: "blue", stat: "draft" },
  { filter: LABO_STATUS_FILTER.Returned, label: "Patient:Labo:Status:Returned", tone: "red", stat: "returned" },
  {
    filter: LABO_STATUS_FILTER.AwaitingCheck,
    label: "Patient:Labo:Status:AwaitingCheck",
    tone: "amber",
    stat: "awaitingCheck",
  },
  { filter: LABO_STATUS_FILTER.Completed, label: "Patient:Labo:Status:Completed", tone: "green", stat: "completed" },
  { filter: LABO_STATUS_FILTER.InWarranty, label: "Patient:Labo:Filter:InWarranty", tone: "purple", stat: "inWarranty" },
  {
    filter: LABO_STATUS_FILTER.WarrantyExpired,
    label: "Patient:Labo:Status:WarrantyExpired",
    tone: "gray",
    stat: "warrantyExpired",
  },
];

interface Props {
  stats: LaboStatsDto | undefined;
  /** The card pressed; null lists every order. */
  selected: LaboStatusFilter | null;
  onChange: (next: LaboStatusFilter | null) => void;
}

/**
 * The six status cards over the patient's Labo table. One at a time filters
 * the list; pressing the pressed card again lists everything. The numbers
 * count the whole record, not the page or the card pressed.
 */
export function LaboStatusFilterCards({ stats, selected, onChange }: Props) {
  return (
    <div className="pd-stat-row pd-stat-row--equal">
      {FILTER_CARDS.map(({ filter, label, tone, stat }) => {
        const active = selected === filter;
        return (
          <button
            type="button"
            key={filter}
            aria-pressed={active}
            className={["pd-stat", `pd-stat--${tone}`, active && "active"].filter(Boolean).join(" ")}
            onClick={() => onChange(active ? null : filter)}
          >
            <strong>{stats?.[stat] ?? 0}</strong>
            <span>{t(label)}</span>
          </button>
        );
      })}
    </div>
  );
}
