import { useCallback, useMemo, useState } from "react";
import type { PatientImageType } from "../api/patientImageApi";
import type { PatientImageViewModel } from "../api/patientImageAdapters";

interface SelectionState {
  stage: PatientImageType;
  picked: ReadonlyMap<string, PatientImageViewModel>;
  /** The last picture ticked without Shift: where a Shift+click range starts. */
  anchorId: string | null;
}

export interface PatientImageSelection {
  /** The column being selected in; null while none is. */
  stage: PatientImageType | null;
  /** What "Xoá N ảnh" would delete, in the order it was ticked. */
  picked: PatientImageViewModel[];
  isPicked: (id: string) => boolean;
  /**
   * Ticks or unticks one picture. With `extend` (Shift+click) it ticks every
   * picture from the last one ticked to this one, in the column's order.
   */
  toggle: (stage: PatientImageType, image: PatientImageViewModel, ordered: PatientImageViewModel[], extend: boolean) => void;
  /** "Chọn cả ngày" / "Chọn tất cả", and their undoing. */
  setMany: (stage: PatientImageType, images: PatientImageViewModel[], on: boolean) => void;
  clear: () => void;
}

/** Shift+click: every deletable picture between the anchor and `image`, or null without an anchor in view. */
function rangeOf(
  ordered: PatientImageViewModel[],
  anchorId: string | null,
  image: PatientImageViewModel,
): PatientImageViewModel[] | null {
  const from = ordered.findIndex((each) => each.id === anchorId);
  const to = ordered.findIndex((each) => each.id === image.id);
  if (from < 0 || to < 0) return null;
  return ordered.slice(Math.min(from, to), Math.max(from, to) + 1).filter((each) => each.deletable);
}

/**
 * The Hình ảnh tab's "chọn nhiều để xoá" (R-1277): one column at a time —
 * ticking a picture in another column starts over there — and only pictures
 * that may be deleted. The column is in selection mode for as long as
 * anything is ticked; unticking the last one leaves it.
 */
export function usePatientImageSelection(): PatientImageSelection {
  const [state, setState] = useState<SelectionState | null>(null);

  const toggle = useCallback<PatientImageSelection["toggle"]>((stage, image, ordered, extend) => {
    if (!image.deletable) return;
    setState((prev) => {
      const same = prev?.stage === stage;
      const picked = new Map(same ? prev.picked : []);
      const range = extend && same ? rangeOf(ordered, prev.anchorId, image) : null;
      if (range) {
        for (const each of range) picked.set(each.id, each);
        return { stage, picked, anchorId: prev?.anchorId ?? null };
      }
      if (picked.has(image.id)) picked.delete(image.id);
      else picked.set(image.id, image);
      return picked.size === 0 ? null : { stage, picked, anchorId: image.id };
    });
  }, []);

  const setMany = useCallback<PatientImageSelection["setMany"]>((stage, images, on) => {
    setState((prev) => {
      const same = prev?.stage === stage;
      const picked = new Map(same ? prev.picked : []);
      for (const each of images) {
        if (!each.deletable) continue;
        if (on) picked.set(each.id, each);
        else picked.delete(each.id);
      }
      return picked.size === 0 ? null : { stage, picked, anchorId: same ? prev.anchorId : null };
    });
  }, []);

  const clear = useCallback(() => setState(null), []);

  return useMemo(
    () => ({
      stage: state?.stage ?? null,
      picked: state ? [...state.picked.values()] : [],
      isPicked: (id: string) => state?.picked.has(id) ?? false,
      toggle,
      setMany,
      clear,
    }),
    [state, toggle, setMany, clear],
  );
}
