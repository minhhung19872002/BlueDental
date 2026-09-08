import { t } from "@/lib/i18n";
import type { PatientImageDay, PatientImageViewModel } from "../../../api/patientImageAdapters";
import { PatientImageSortableRow } from "./PatientImageSortableRow";

interface Props {
  day: PatientImageDay;
  canSort: boolean;
  canDelete: boolean;
  onView: (image: PatientImageViewModel) => void;
  onDelete: (image: PatientImageViewModel) => void;
  onReorder: (day: PatientImageDay, from: number, to: number) => void;
}

/**
 * One day on the timeline: the date pill and dot on the left, the count under
 * them, and the horizontal row of cards.
 */
export function PatientImageDayRow({ day, canSort, canDelete, onView, onDelete, onReorder }: Props) {
  return (
    <section className="pi-day" data-testid="patient-image-day" data-day={day.key}>
      <div className="pi-day-side">
        <span className="pi-day-pill">{day.label}</span>
        <span className="pi-day-dot" aria-hidden="true" />
        <p className="pi-day-count">{t("{0} ảnh", day.images.length)}</p>
      </div>

      <PatientImageSortableRow
        day={day}
        canSort={canSort}
        canDelete={canDelete}
        onView={onView}
        onDelete={onDelete}
        onReorder={onReorder}
        className="pi-day-cards"
      />
    </section>
  );
}
