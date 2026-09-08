import { useMemo, useState } from "react";
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
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { PatientImageDay, PatientImageViewModel } from "../../../api/patientImageAdapters";
import { PatientImageCard } from "./PatientImageCard";

interface Props {
  day: PatientImageDay;
  canSort: boolean;
  canDelete: boolean;
  onView: (image: PatientImageViewModel) => void;
  onDelete: (image: PatientImageViewModel) => void;
  /** Resolves once the new order is stored, so the drop can settle on it. */
  onReorder: (day: PatientImageDay, from: number, to: number) => void | Promise<void>;
  /** The class the cards sit in — each caller draws its own strip. */
  className: string;
  /** Given, every card carries a tick box; see PatientImageCard. */
  isChecked?: (image: PatientImageViewModel) => boolean;
  onCheckedChange?: (image: PatientImageViewModel, checked: boolean) => void;
  showView?: boolean;
}

/**
 * One day's cards, in their stored order, draggable among themselves.
 *
 * Its own drag context per day, so a card can only ever be dropped among the
 * cards of its own day — the reference ignores drops onto another day, and this
 * cannot even offer one. Shared by the Hình ảnh timeline and the "Chọn ảnh
 * hiển thị" dialog of Chẩn đoán & Tư vấn, which the reference draws with the
 * same card.
 */
export function PatientImageSortableRow({
  day,
  canSort,
  canDelete,
  onView,
  onDelete,
  onReorder,
  className,
  isChecked,
  onCheckedChange,
  showView,
}: Props) {
  /**
   * The order the drop just produced, held until the store agrees with it.
   *
   * dnd-kit drops its transform in the same commit as the drag ends, but the
   * query cache notifies its observers a tick later — so without this the card
   * snapped back to where it started for a frame before the new order arrived.
   */
  const [dropped, setDropped] = useState<string[] | null>(null);

  const cards = useMemo(() => {
    if (!dropped) return day.images;
    const byId = new Map(day.images.map((image) => [image.id, image]));
    // A card deleted or added while the save was in flight makes the held order
    // meaningless; the stored one is then the only truth.
    if (dropped.length !== byId.size || dropped.some((id) => !byId.has(id))) return day.images;
    return dropped.map((id) => byId.get(id) as PatientImageViewModel);
  }, [dropped, day.images]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = cards.findIndex((image) => image.id === active.id);
    const to = cards.findIndex((image) => image.id === over.id);
    if (from < 0 || to < 0) return;

    setDropped(arrayMove(cards, from, to).map((image) => image.id));
    try {
      // The day is handed over in the order on screen, not the stored one: a
      // second drag started before the first has saved must renumber against
      // what the user is looking at.
      await onReorder({ ...day, images: cards }, from, to);
    } finally {
      // Either the store now holds this order, or it rolled back and should win.
      setDropped(null);
    }
  };

  return (
    <DndContext
      id={`patient-image-day-${day.key}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={cards.map((image) => image.id)}
        strategy={horizontalListSortingStrategy}
      >
        <div className={className}>
          {cards.map((image) => (
            <PatientImageCard
              key={image.id}
              image={image}
              canSort={canSort}
              canDelete={canDelete}
              onView={onView}
              onDelete={onDelete}
              checked={isChecked?.(image)}
              onCheckedChange={onCheckedChange}
              showView={showView}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
