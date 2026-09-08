import { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type { PatientImageViewModel } from "../api/patientImageAdapters";

interface DraggedOrder {
  /** The row the order was dragged on; it is only good for that row. */
  base: PatientImageViewModel[];
  ids: string[];
}

export interface DraggedOrderState {
  /** The row's images in the order the user last dropped them. */
  ordered: PatientImageViewModel[];
  /** Records a drop, indices into `ordered`. */
  move: (from: number, to: number) => void;
}

function sortByIds(images: PatientImageViewModel[], ids: string[]): PatientImageViewModel[] {
  const rank = (image: PatientImageViewModel) => {
    const index = ids.indexOf(image.id);
    return index < 0 ? ids.length : index;
  };
  return [...images].sort((a, b) => rank(a) - rank(b));
}

/**
 * The order a sortable row shows between a drop and the cache catching up.
 *
 * dnd-kit clears its transforms the instant the pointer lifts, but the query
 * cache reports the new order a task later — long enough, when that render is
 * heavy, for the neighbour to slide back before it is moved in the DOM.
 * Reordering here, in the same batch as the drop, lets dnd-kit swap the
 * items without a transition. The local order is forgotten as soon as the
 * row's images change identity: the cache (or a rollback) has spoken.
 */
export function useDraggedOrder(images: PatientImageViewModel[]): DraggedOrderState {
  const [dragged, setDragged] = useState<DraggedOrder | null>(null);
  const ordered = dragged?.base === images ? sortByIds(images, dragged.ids) : images;

  const move = (from: number, to: number) => {
    setDragged({ base: images, ids: arrayMove(ordered, from, to).map((image) => image.id) });
  };

  return { ordered, move };
}
