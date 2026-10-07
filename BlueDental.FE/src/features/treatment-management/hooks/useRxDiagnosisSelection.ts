import { useCallback, useMemo, useRef, useState } from "react";
import type { RxDiagnosisRow } from "../types/prescription";
import { mergedNotes } from "../utils/rxDiagnosis";

interface Options {
  /** The patient's phiếu điều trị diagnoses, as the picker lists them. */
  sources: RxDiagnosisRow[];
  readNote: () => string;
  writeNote: (note: string) => void;
}

/**
 * The diagnoses picked for the slip, in pick order (F-58).
 *
 * A pick shows its live source row when the plan is still listed, else the
 * snapshot saved with the slip — so a slip whose plan was cancelled later
 * still shows what it was written against.
 *
 * Each pick change refills "Ghi chú chẩn đoán" from the picks' own notes,
 * unless the doctor has written something else there: the note is only
 * replaced while it is empty or still exactly what was filled in last.
 */
export function useRxDiagnosisSelection({ sources, readNote, writeNote }: Options) {
  const [picked, setPicked] = useState<RxDiagnosisRow[]>([]);
  /** The note last filled in automatically; null until a pick changes it. */
  const lastAutoNote = useRef<string | null>(null);

  const rows = useMemo(() => {
    const live = new Map(sources.map((row) => [row.key, row]));
    return picked.map((row) => live.get(row.key) ?? row);
  }, [picked, sources]);

  const pickedKeys = useMemo(() => new Set(picked.map((row) => row.key)), [picked]);

  const apply = useCallback(
    (next: RxDiagnosisRow[]) => {
      setPicked(next);
      const current = readNote().trim();
      if (current && current !== lastAutoNote.current) return;
      const live = new Map(sources.map((row) => [row.key, row]));
      const note = mergedNotes(next.map((row) => live.get(row.key) ?? row));
      lastAutoNote.current = note;
      writeNote(note);
    },
    [sources, readNote, writeNote],
  );

  const toggle = useCallback(
    (row: RxDiagnosisRow) =>
      apply(
        pickedKeys.has(row.key)
          ? picked.filter((item) => item.key !== row.key)
          : [...picked, row],
      ),
    [apply, picked, pickedKeys],
  );

  const remove = useCallback(
    (key: string) => apply(picked.filter((item) => item.key !== key)),
    [apply, picked],
  );

  /** Opening the dialog: the saved picks come back, the saved note is kept. */
  const restore = useCallback((saved: RxDiagnosisRow[]) => {
    lastAutoNote.current = null;
    setPicked(saved);
  }, []);

  return { rows, pickedKeys, toggle, remove, restore };
}
