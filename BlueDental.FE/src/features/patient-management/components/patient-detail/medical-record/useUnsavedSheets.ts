import { useState } from "react";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type { PatientMedicalRecordDto } from "../../../api/medicalRecordApi";
import { parseFieldValues } from "../medicalRecordDraft";
import type { FieldValues } from "./fieldValues";

/** Same blanks, same values — in whatever order they were read off the sheet. */
function sameValues(a: FieldValues, b: FieldValues): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

interface Options {
  sheets: readonly PatientMedicalRecordDto[];
  edits: Readonly<Record<string, FieldValues>>;
  /** Saves one sheet's edits; answers whether it went through. */
  save: (sheet: PatientMedicalRecordDto) => Promise<boolean>;
  /** Drops the edits of these sheets. */
  discard: (ids: string[]) => void;
}

/**
 * Asks before written-but-unsaved sheets are left behind (clinic, 2026-10-16:
 * "Quên lưu bấm qua tab khác trở lại mất tiu"): opening another sheet, leaving
 * the Bệnh án view or the patient (any in-app navigation — the shared guard),
 * and reloading or closing the tab (the browser's own prompt). The question
 * offers Lưu, Không lưu and Ở lại.
 *
 * A sheet is unsaved when what is written on it differs from what was saved —
 * clicking into a blank and out again is not a change.
 */
export function useUnsavedSheets({ sheets, edits, save, discard }: Options) {
  const unsaved = sheets.filter((sheet) => {
    const written = edits[sheet.id];
    return written !== undefined && !sameValues(written, parseFieldValues(sheet.content));
  });
  const guard = useUnsavedChangesGuard(unsaved.length > 0);

  /** A step inside the view (opening another sheet) waiting on the answer. */
  const [pending, setPending] = useState<{ action: () => void; ids: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  /** Runs `action` now, or once the unsaved sheets among `ids` are answered for. */
  const ask = (action: () => void, ids?: readonly string[]) => {
    const concerned = unsaved.filter((sheet) => !ids || ids.includes(sheet.id)).map((sheet) => sheet.id);
    if (concerned.length === 0) action();
    else setPending({ action, ids: concerned });
  };

  const concerned = pending ? unsaved.filter((sheet) => pending.ids.includes(sheet.id)) : unsaved;

  const go = () => {
    const step = pending;
    setPending(null);
    if (step) step.action();
    else guard.proceed();
  };

  const onSave = async () => {
    setSaving(true);
    try {
      for (const sheet of concerned) {
        if (!(await save(sheet))) return;
      }
      go();
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    discard(concerned.map((sheet) => sheet.id));
    go();
  };

  const onStay = () => {
    setPending(null);
    guard.stay();
  };

  return {
    ask,
    dialog: {
      open: pending !== null || guard.isBlocked,
      saving,
      titles: concerned.map((sheet) => sheet.title),
      onSave: () => void onSave(),
      onDiscard,
      onStay,
    },
  };
}
