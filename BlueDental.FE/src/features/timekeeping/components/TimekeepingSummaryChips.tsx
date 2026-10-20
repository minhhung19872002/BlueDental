import { TimekeepingStatChips } from "./TimekeepingStatChips";
import { useTimeKeepingSummary } from "../api/timekeepingQueries";
import { useBranchFilter } from "@/lib/clinicBranch";

interface Props {
  workDate: string;
}

/**
 * The board's KPI chips, fetched on their own so they can sit on the calendar
 * tab row (BA R-999). Same query key as the board, so one request serves both.
 */
export function TimekeepingSummaryChips({ workDate }: Props) {
  const branchFilter = useBranchFilter();
  const { data: summary } = useTimeKeepingSummary(branchFilter, workDate);
  return <TimekeepingStatChips summary={summary} />;
}
