import { t } from "@/lib/i18n";
import { CARE_STATUS, type CareStatsDto, type CareStatus } from "../api/careApi";
import type { CareStatusModel } from "../careTabs";

/**
 * The counter tiles above the care table. Clicking one filters the list by
 * status; the counts themselves do not refetch, exactly like the reference.
 */
export type CareCounterKey =
  | "total"
  | "success"
  | "fail"
  | "new"
  | "zalo"
  | "contacted"
  | "notContacted";

/** What a counter narrows the list to; none = everything. */
export interface CareCounterFilter {
  status?: CareStatus;
  contacted?: boolean;
}

interface CounterDef {
  key: CareCounterKey;
  label: () => string;
  value: (stats: CareStatsDto) => number;
  filter: CareCounterFilter;
}

const TOTAL: CounterDef = {
  key: "total", label: () => t("CSKH:Counter:Total"), value: (s) => s.totalPatients, filter: {},
};
const ZALO: CounterDef = {
  key: "zalo", label: () => t("CSKH:Counter:ZaloSent"), value: (s) => s.zaloSent, filter: {},
};

const COUNTERS: Record<CareStatusModel, readonly CounterDef[]> = {
  result: [
    TOTAL,
    { key: "success", label: () => t("CSKH:Counter:Success"), value: (s) => s.succeeded, filter: { status: CARE_STATUS.Succeeded } },
    { key: "fail", label: () => t("CSKH:Counter:Failed"), value: (s) => s.failed, filter: { status: CARE_STATUS.Failed } },
    { key: "new", label: () => t("CSKH:Counter:NotCared"), value: (s) => s.notCaredYet, filter: { status: CARE_STATUS.New } },
    ZALO,
  ],
  // Only Đã liên hệ / Chưa liên hệ on these tabs (owner, 2026-10-05).
  contact: [
    TOTAL,
    { key: "contacted", label: () => t("CSKH:Counter:Contacted"), value: (s) => s.contacted, filter: { contacted: true } },
    { key: "notContacted", label: () => t("CSKH:Counter:NotContacted"), value: (s) => s.notContacted, filter: { contacted: false } },
    ZALO,
  ],
};

/** Tile colours of the contact model reuse the result tiles' palette. */
const TONE: Partial<Record<CareCounterKey, CareCounterKey>> = {
  contacted: "success",
  notContacted: "new",
};

interface CareCountersProps {
  model: CareStatusModel;
  stats: CareStatsDto | undefined;
  active: CareCounterKey;
  onChange: (key: CareCounterKey, filter: CareCounterFilter) => void;
}

export function CareCounters({ model, stats, active, onChange }: CareCountersProps) {
  return (
    <div className="cskh-counters">
      {COUNTERS[model].map((counter) => (
        <button
          key={counter.key}
          type="button"
          aria-pressed={active === counter.key}
          className={[
            "cskh-counter",
            `cskh-counter--${TONE[counter.key] ?? counter.key}`,
            active === counter.key && "cskh-counter--pressed",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(counter.key, counter.filter)}
        >
          <div className="cskh-counter-value">{stats ? counter.value(stats) : 0}</div>
          <div className="cskh-counter-label">{counter.label()}</div>
        </button>
      ))}
    </div>
  );
}
