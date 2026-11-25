import { useCallback, useRef } from "react";
import type { PatientImageType } from "../api/patientImageApi";
import type { PatientImageViewModel } from "../api/patientImageAdapters";
import { useMarqueeSelect } from "./useMarqueeSelect";
import type { PatientImageSelection } from "./usePatientImageSelection";

interface Options {
  stage: PatientImageType;
  /** The column's pictures in the order they are drawn. */
  shown: PatientImageViewModel[];
  selection: PatientImageSelection;
  /** Whoever may delete may select, by ticking or by "bôi". */
  enabled: boolean;
}

/**
 * "Bôi để chọn" in one stage column (R-1322). What the marquee catches is
 * added to what this column already had ticked — a second sweep picks up
 * more, it never drops the first; a picture is unticked by its own tick. A
 * sweep in another column starts over there, as a tick does (R-1277).
 */
export function usePatientImageMarquee({ stage, shown, selection, enabled }: Options) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /** What this column had ticked when the sweep began. */
  const before = useRef<PatientImageViewModel[]>([]);
  const { mark, picked } = selection;
  const ownPicked = selection.stage === stage ? picked : null;

  const handleStart = useCallback(() => {
    before.current = ownPicked ?? [];
  }, [ownPicked]);

  const handleChange = useCallback(
    (ids: string[]) => {
      const caught = new Set(ids);
      const kept = new Set(before.current.map((image) => image.id));
      const added = shown.filter((image) => caught.has(image.id) && !kept.has(image.id));
      mark(stage, [...before.current, ...added]);
    },
    [shown, mark, stage],
  );

  const { onPointerDown } = useMarqueeSelect({
    scrollRef,
    boxRef,
    itemSelector: "[data-image-id]",
    enabled,
    onStart: handleStart,
    onChange: handleChange,
  });

  return { scrollRef, boxRef, onPointerDown };
}
