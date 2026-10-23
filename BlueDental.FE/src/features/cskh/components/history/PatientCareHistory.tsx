import { useState } from "react";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { HISTORY_FILTER, useCareHistory, useCareOverview, type HistoryFilter } from "../../api/careHistoryApi";
import { CareNoteComposer } from "./CareNoteComposer";
import { CareOverviewCards } from "./CareOverviewCards";
import { CareTimeline } from "./CareTimeline";

type Period = [Dayjs, Dayjs] | null;

/**
 * "Lịch sử chăm sóc khách hàng" under the record's CSKH table (BA P2210):
 * the note box, the history newest first, the contact state and the year's
 * cost. The period filter covers the whole history and starts on all time.
 */
export function PatientCareHistory({ patientId }: { patientId: string }) {
  const [period, setPeriod] = useState<Period>(null);
  const [filter, setFilter] = useState<HistoryFilter>(HISTORY_FILTER.All);
  const { canCreate, canUpdate } = useAbility("treatmentCskh");
  const { canUpdate: canHandleInbox } = useAbility("cskhInbox");
  const history = useCareHistory(patientId, {
    fromDate: period ? period[0].startOf("day").toISOString() : null,
    toDate: period ? period[1].endOf("day").toISOString() : null,
    kind: filter,
  });
  const overview = useCareOverview(patientId);

  return (
    <section className="ch" aria-labelledby="ch-title">
      <header className="ch-head">
        <h2 id="ch-title" className="ch-title">{t("CSKH:History:Title")}</h2>
        <DatePicker.RangePicker
          allowClear
          format="DD/MM/YYYY"
          aria-label={t("CSKH:History:Period")}
          placeholder={[t("CSKH:History:AllTime"), t("CSKH:History:AllTime")]}
          value={period}
          onChange={(value) => setPeriod(value && value[0] && value[1] ? [value[0], value[1]] : null)}
        />
      </header>
      <div className="ch-grid">
        <div className="ch-main">
          {canCreate && <CareNoteComposer patientId={patientId} />}
          <CareTimeline
            entries={history.data}
            loading={history.isFetching}
            filter={filter}
            canEditNotes={canUpdate || canHandleInbox}
            onFilterChange={setFilter}
          />
        </div>
        <div className="ch-side">
          <CareOverviewCards overview={overview.data} loading={overview.isLoading} />
        </div>
      </div>
    </section>
  );
}
