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
 * One day in a stage column: the date and its count on a header that sticks
 * while the column scrolls, then the day's tiles.
 */
export function PatientImageDayRow({ day, canSort, canDelete, onView, onDelete, onReorder }: Props) {
  return (
    <section className="pi-day" data-testid="patient-image-day" data-day={day.key}>
      <header className="pi-day-head">
        <span className="pi-day-date">{day.label}</span>
        <span className="pi-day-count">{t("Patient:Image:DayCount", day.images.length)}</span>
      </header>

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
