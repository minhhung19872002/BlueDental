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
import type { PatientImageDay, PatientImageViewModel } from "../../api/patientImageAdapters";
import { useDraggedOrder } from "../../hooks/useDraggedOrder";
import { ConsultingImageCard } from "./ConsultingImageCard";

interface Props {
  day: PatientImageDay;
  /** Ids unticked in the dialog; everything else is on the panel. */
  hidden: string[];
  canSort: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onDelete?: (image: PatientImageViewModel) => void;
  onReorder: (day: PatientImageDay, from: number, to: number) => void;
}

/**
 * One day of "Chọn ảnh hiển thị": its heading and the sideways row of cards.
 * Each day is its own drag context, so a card can only be dropped among the
 * cards of its own day. The dropped order is shown at once — the cache
 * confirms it a moment later — so dnd-kit can swap the cards without a
 * transition instead of sliding the neighbour back first.
 */
export function ConsultingImageDay({ day, hidden, canSort, onToggle, onDelete, onReorder }: Props) {
  const { ordered, move } = useDraggedOrder(day.images);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ordered.findIndex((image) => image.id === active.id);
    const to = ordered.findIndex((image) => image.id === over.id);
    if (from < 0 || to < 0) return;
    move(from, to);
    onReorder({ ...day, images: ordered }, from, to);
  };

  return (
    <section className="pd-image-day" data-day={day.key}>
      <h4>{day.label}</h4>
      <DndContext
        id={`consulting-image-day-${day.key}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={ordered.map((image) => image.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="pd-image-cards">
            {ordered.map((image) => (
              <ConsultingImageCard
                key={image.id}
                image={image}
                checked={!hidden.includes(image.id)}
                canSort={canSort}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
