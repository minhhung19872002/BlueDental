import { useCallback, useMemo, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useDebounce } from "@/hooks/useDebounce";
import { endOfWeek, startOfWeek, type WeekStart } from "@/utils/week";
import type {
  HistoryAction,
  HistoryFilter,
  HistorySource,
  HistoryStatusGroup,
} from "../../types/appointmentHistory";

export interface HistoryFilterValues {
  /** Any day inside the week being shown; the range is that whole week. */
  week: Dayjs;
  actions: HistoryAction[];
  statuses: HistoryStatusGroup[];
  sources: HistorySource[];
  actor: string;
  keyword: string;
  importantOnly: boolean;
}

/** The reference's history week runs Sunday to Saturday, unlike its other calendars. */
export const HISTORY_WEEK_START: WeekStart = 0;

const TEXT_DEBOUNCE_MS = 300;

function initialValues(): HistoryFilterValues {
  return {
    week: dayjs(),
    actions: [],
    statuses: [],
    sources: [],
    actor: "",
    keyword: "",
    importantOnly: false,
  };
}

/**
 * The dialog's filter row: what the user picked, and the same thing as the
 * query the server takes. The two text boxes reach the server debounced.
 */
export function useHistoryFilters(patientId: string) {
  const [values, setValues] = useState<HistoryFilterValues>(initialValues);
  const actor = useDebounce(values.actor, TEXT_DEBOUNCE_MS);
  const keyword = useDebounce(values.keyword, TEXT_DEBOUNCE_MS);

  const patch = useCallback((change: Partial<HistoryFilterValues>) => {
    setValues((current) => ({ ...current, ...change }));
  }, []);

  const clear = useCallback(() => setValues(initialValues()), []);

  const { week, actions, statuses, sources, importantOnly } = values;
  const filter = useMemo<HistoryFilter>(
    () => ({
      patientId,
      fromDate: startOfWeek(week, HISTORY_WEEK_START).format("YYYY-MM-DD"),
      toDate: endOfWeek(week, HISTORY_WEEK_START).format("YYYY-MM-DD"),
      actions,
      statuses,
      sources,
      actor,
      keyword,
      importantOnly,
    }),
    [patientId, week, actions, statuses, sources, actor, keyword, importantOnly],
  );

  const isDirty =
    actions.length > 0 ||
    statuses.length > 0 ||
    sources.length > 0 ||
    importantOnly ||
    values.actor.trim() !== "" ||
    values.keyword.trim() !== "";

  return { values, patch, clear, filter, isDirty };
}
