import type { RefObject } from "react";
import { Spin } from "antd";
import { t } from "@/lib/i18n";
import type { PatientImageDay, PatientImageViewModel } from "../../../api/patientImageAdapters";
import { PatientImageDayRow } from "./PatientImageDayRow";

interface Props {
  days: PatientImageDay[];
  isLoading: boolean;
  isLoadingMore: boolean;
  /** Something is being fetched, uploaded, moved or deleted: dim the timeline. */
  busy: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
  canSort: boolean;
  canDelete: boolean;
  onView: (image: PatientImageViewModel) => void;
  onDelete: (image: PatientImageViewModel) => void;
  onReorder: (day: PatientImageDay, from: number, to: number) => void;
}

function EmptyBox({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div className="pi-empty" role="status">
        <p className="pi-empty-title">{t("Patient:Image:LoadingText")}</p>
      </div>
    );
  }
  return (
    <div className="pi-empty" data-testid="patient-image-empty">
      <p className="pi-empty-title">{t("Patient:Image:EmptyTitle")}</p>
      <p className="pi-empty-hint">{t("Patient:Image:EmptyHint")}</p>
    </div>
  );
}

/**
 * The day-by-day list under the toolbar, with the vertical line the pills sit
 * on. Grows as it is scrolled; the sentinel at the foot asks for the next
 * page. Content-height, never stretched to fill the tab.
 */
export function PatientImageTimeline({
  days,
  isLoading,
  isLoadingMore,
  busy,
  sentinelRef,
  ...rowProps
}: Props) {
  if (days.length === 0) return <EmptyBox loading={isLoading} />;

  return (
    <div className={["pi-timeline", busy && "pi-timeline--busy"].filter(Boolean).join(" ")}>
      {busy && (
        <div className="pi-busy" role="status" aria-label={t("Patient:Image:Processing")}>
          <Spin />
        </div>
      )}
      {days.map((day) => (
        <PatientImageDayRow key={day.key} day={day} {...rowProps} />
      ))}
      <div ref={sentinelRef} className="pi-sentinel" aria-hidden="true" />
      {isLoadingMore && <p className="pi-loading-more">{t("Patient:Image:LoadingMore")}</p>}
    </div>
  );
}
