import { Checkbox } from "antd";
import { t } from "@/lib/i18n";
import type { PatientImageDay, PatientImageViewModel } from "../../../api/patientImageAdapters";
import { tickStateOf, useColumnSelection } from "./columnSelection";
import { PatientImageSortableRow } from "./PatientImageSortableRow";

interface Props {
  day: PatientImageDay;
  canSort: boolean;
  canDelete: boolean;
  onView: (image: PatientImageViewModel) => void;
  onDelete: (image: PatientImageViewModel) => void;
  onReorder: (day: PatientImageDay, from: number, to: number) => void;
}

/** "Chọn cả ngày" (R-1277): on hover before a selection, always during one. */
function DayTick({ day }: { day: PatientImageDay }) {
  const selection = useColumnSelection();
  const { selectable, all, some } = tickStateOf(day.images, selection.isPicked);
  if (!selection.enabled || selectable.length === 0) return null;

  return (
    <Checkbox
      className="pi-day-tick"
      checked={all}
      indeterminate={some}
      aria-label={t("Patient:Image:SelectDay", day.label)}
      onChange={(event) => selection.setMany(selectable, event.target.checked)}
    />
  );
}

/**
 * One day in a stage column: the date and its count on a header that sticks
 * while the column scrolls, then the day's tiles.
 */
export function PatientImageDayRow({ day, canSort, canDelete, onView, onDelete, onReorder }: Props) {
  const { active } = useColumnSelection();

  return (
    <section className="pi-day" data-testid="patient-image-day" data-day={day.key}>
      <header className={["pi-day-head", active && "pi-day-head--selecting"].filter(Boolean).join(" ")}>
        <DayTick day={day} />
        <span className="pi-day-date">{day.label}</span>
        <span className="pi-day-count">{t("Patient:Image:DayCount", day.images.length)}</span>
      </header>

      <PatientImageSortableRow
        day={day}
        canSort={canSort && !active}
        canDelete={canDelete}
        onView={onView}
        onDelete={onDelete}
        onReorder={onReorder}
        className="pi-day-cards"
      />
    </section>
  );
}
