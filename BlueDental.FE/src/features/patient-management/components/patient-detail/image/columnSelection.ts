import { createContext, useContext } from "react";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";

/**
 * One stage column's side of the selection (R-1277), handed down to its days
 * and tiles without threading it through every layer between.
 */
export interface ColumnSelection {
  /** Whoever may delete gets the ticks at all. */
  enabled: boolean;
  /** This column is being selected in: a click on a picture ticks it. */
  active: boolean;
  isPicked: (id: string) => boolean;
  /** `extend` is Shift+click: tick the run from the last picture ticked. */
  toggle: (image: PatientImageViewModel, extend: boolean) => void;
  setMany: (images: PatientImageViewModel[], on: boolean) => void;
}

const NO_SELECTION: ColumnSelection = {
  enabled: false,
  active: false,
  isPicked: () => false,
  toggle: () => undefined,
  setMany: () => undefined,
};

const ColumnSelectionContext = createContext<ColumnSelection>(NO_SELECTION);

export const ColumnSelectionProvider = ColumnSelectionContext.Provider;

export function useColumnSelection(): ColumnSelection {
  return useContext(ColumnSelectionContext);
}

/** How many of `images` may be ticked, and how many are: for a day's or a column's tick. */
export function tickStateOf(images: PatientImageViewModel[], isPicked: (id: string) => boolean) {
  const selectable = images.filter((image) => image.deletable);
  const picked = selectable.filter((image) => isPicked(image.id)).length;
  return {
    selectable,
    all: selectable.length > 0 && picked === selectable.length,
    some: picked > 0 && picked < selectable.length,
  };
}
