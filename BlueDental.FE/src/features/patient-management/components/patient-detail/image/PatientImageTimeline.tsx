import type { RefObject } from "react";
import { Spin } from "antd";
import { t } from "@/lib/i18n";
import type { PatientImageDay, PatientImageViewModel } from "../../../api/patientImageAdapters";
import { PatientImageDayRow } from "./PatientImageDayRow";

interface Props {
  days: PatientImageDay[];
  /** Shown in place of the days while there are none: loading, none yet, or none match. */
  emptyText: string;
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

/**
 * A stage column's days, newest first. Grows as the column is scrolled; the
 * sentinel at the foot asks for the next page. The running number on the
 * tiles counts down the whole column, across its days.
 */
export function PatientImageTimeline({
  days,
  emptyText,
  isLoadingMore,
  busy,
  sentinelRef,
  ...rowProps
}: Props) {
  if (days.length === 0) {
    return (
      <p className="pi-empty" role="status" data-testid="patient-image-empty">
        {emptyText}
      </p>
    );
  }

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
