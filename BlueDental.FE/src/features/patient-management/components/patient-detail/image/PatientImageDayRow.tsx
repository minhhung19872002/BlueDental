import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { t } from "@/lib/i18n";
import type { PatientImageDay, PatientImageViewModel } from "../../../api/patientImageAdapters";
import { PatientImageCard } from "./PatientImageCard";

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
 * them, and the horizontal row of cards. Each day is its own drag context, so
 * a card can only ever be dropped among the cards of its own day — the
 * reference ignores drops onto another day, and this cannot even offer one.
 */
export function PatientImageDayRow({ day, canSort, canDelete, onView, onDelete, onReorder }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = day.images.findIndex((image) => image.id === active.id);
    const to = day.images.findIndex((image) => image.id === over.id);
    if (from >= 0 && to >= 0) onReorder(day, from, to);
  };

  return (
    <section className="pi-day" data-testid="patient-image-day" data-day={day.key}>
      <div className="pi-day-side">
        <span className="pi-day-pill">{day.label}</span>
        <span className="pi-day-dot" aria-hidden="true" />
        <p className="pi-day-count">{t("{0} ảnh", day.images.length)}</p>
      </div>

      <DndContext
        id={`patient-image-day-${day.key}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={day.images.map((image) => image.id)} strategy={horizontalListSortingStrategy}>
          <div className="pi-day-cards">
            {day.images.map((image) => (
              <PatientImageCard
                key={image.id}
                image={image}
                canSort={canSort}
                canDelete={canDelete}
                onView={onView}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
