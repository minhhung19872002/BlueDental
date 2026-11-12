import { useCallback } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDndContext,
  useSensor,
  useSensors,
  type Active,
  type AutoScrollOptions,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type Over,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { BlockDraft } from "./formTemplateModel";
import { accepts, fieldTarget, moveField, reorderBlocks, sectionOf, type LayoutDragData } from "./layoutDnd";

type SetBlocks = (change: (blocks: BlockDraft[]) => BlockDraft[]) => void;

const dragData = (data: { current?: unknown } | undefined): LayoutDragData | undefined =>
  data?.current as LayoutDragData | undefined;

/**
 * Only the targets that can take what is dragged count: a block lands among
 * blocks; a field on the field under the pointer, else on the section list
 * under it (an empty section, or below its last field), else on the nearest
 * field — the keyboard has no pointer, so it always takes the nearest.
 */
const collision: CollisionDetection = (args) => {
  const dragged = dragData(args.active.data)?.type;
  const droppableContainers = args.droppableContainers.filter((container) =>
    accepts(dragged, dragData(container.data)?.type),
  );
  if (dragged === "block") return closestCenter({ ...args, droppableContainers });

  const hits = pointerWithin({ ...args, droppableContainers });
  const fieldHit = hits.filter((hit) => dragData(hit.data?.droppableContainer?.data)?.type === "field");
  if (fieldHit.length > 0) return fieldHit;
  if (hits.length > 0) return hits;
  const fields = droppableContainers.filter((container) => dragData(container.data)?.type === "field");
  return closestCenter({ ...args, droppableContainers: fields });
};

/**
 * Whether a target of this kind takes what is being dragged now. The others
 * switch off for the drag, so the arrow keys step from block to block, or from
 * field to field, and never into a field of a block being moved.
 */
export function useTakesDrag(target: LayoutDragData["type"]): boolean {
  const dragged = dragData(useDndContext().active?.data)?.type;
  return dragged === undefined || accepts(dragged, target);
}

/** True when the dragged row's middle sits below the middle of the row it is over. */
function isBelow(active: Active, over: Over): boolean {
  const moved = active.rect.current.translated;
  if (!moved) return false;
  return moved.top + moved.height / 2 > over.rect.top + over.rect.height / 2;
}

/**
 * Scrolls only when the drag nears the list's very edge: the builder's list
 * is short, and the default fifth of its height made it run off as soon as a
 * row near the bottom was picked up.
 */
const AUTO_SCROLL: AutoScrollOptions = { threshold: { x: 0, y: 0.08 }, acceleration: 6 };

const useBuilderSensors = () =>
  useSensors(
    // A short move starts a drag, so a click on the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

/**
 * Drag and drop in the Mẫu phiếu builder (R-1202): blocks among blocks by
 * their handle, fields within a section and across sections. A field crossing
 * into another section moves there as it is dragged over it, so the list shows
 * where it will land; the drop then settles its place.
 */
export function useLayoutDnd(setBlocks: SetBlocks) {
  const sensors = useBuilderSensors();

  const onDragOver = useCallback(
    ({ active, over }: DragOverEvent) => {
      const target = dragData(over?.data);
      if (!over || dragData(active.data)?.type !== "field" || !target) return;
      const activeId = String(active.id);
      const below = isBelow(active, over);
      setBlocks((blocks) => {
        const place = fieldTarget(blocks, { id: String(over.id), data: target }, below);
        if (!place || sectionOf(blocks, activeId)?.rowId === place.blockRowId) return blocks;
        return moveField(blocks, activeId, place.blockRowId, place.index);
      });
    },
    [setBlocks],
  );

  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      const dragged = dragData(active.data);
      const target = dragData(over?.data);
      if (!over || !dragged || !target) return;
      const activeId = String(active.id);
      const overId = String(over.id);
      if (dragged.type === "block") {
        setBlocks((blocks) => reorderBlocks(blocks, activeId, overId));
        return;
      }
      // Within a section the list has already slid aside: the field takes the place of the one it is over.
      setBlocks((blocks) => {
        const place = fieldTarget(blocks, { id: overId, data: target }, false);
        return place ? moveField(blocks, activeId, place.blockRowId, place.index) : blocks;
      });
    },
    [setBlocks],
  );

  return { sensors, autoScroll: AUTO_SCROLL, collisionDetection: collision, onDragOver, onDragEnd };
}

/** The preview's grid: blocks only, so the nearest centre is enough. */
export function usePreviewDnd(onReorder: (activeRowId: string, overRowId: string) => void) {
  const sensors = useBuilderSensors();
  const onDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
    },
    [onReorder],
  );
  return { sensors, autoScroll: AUTO_SCROLL, collisionDetection: closestCenter, onDragEnd };
}
