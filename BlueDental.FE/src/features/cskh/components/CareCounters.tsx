import { t } from "@/lib/i18n";
import { CARE_STATUS, type CareStatsDto, type CareStatus } from "../api/careApi";

/**
 * The 5 counter tiles above the care table. Clicking one filters the list by
 * status; the counts themselves do not refetch, exactly like the reference.
 */
export type CareCounterKey = "total" | "success" | "fail" | "new" | "zalo";

interface CounterDef {
  key: CareCounterKey;
  label: () => string;
  value: (stats: CareStatsDto) => number;
  status: CareStatus | undefined;
}

const COUNTERS: readonly CounterDef[] = [
  { key: "total", label: () => t("Tổng khách"), value: (s) => s.totalPatients, status: undefined },
  { key: "success", label: () => t("Thành công"), value: (s) => s.succeeded, status: CARE_STATUS.Succeeded },
  { key: "fail", label: () => t("Thất bại"), value: (s) => s.failed, status: CARE_STATUS.Failed },
  { key: "new", label: () => t("Chưa CS"), value: (s) => s.notCaredYet, status: CARE_STATUS.New },
  { key: "zalo", label: () => t("Đã gửi Zalo"), value: (s) => s.zaloSent, status: undefined },
];

interface CareCountersProps {
  stats: CareStatsDto | undefined;
  active: CareCounterKey;
  onChange: (key: CareCounterKey, status: CareStatus | undefined) => void;
}

export function CareCounters({ stats, active, onChange }: CareCountersProps) {
  return (
    <div className="cskh-counters">
      {COUNTERS.map((counter) => (
        <button
          key={counter.key}
          type="button"
          aria-pressed={active === counter.key}
          className={[
            "cskh-counter",
            `cskh-counter--${counter.key}`,
            active === counter.key && "cskh-counter--pressed",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onChange(counter.key, counter.status)}
        >
          <div className="cskh-counter-value">{stats ? counter.value(stats) : 0}</div>
          <div className="cskh-counter-label">{counter.label()}</div>
        </button>
      ))}
    </div>
  );
}
