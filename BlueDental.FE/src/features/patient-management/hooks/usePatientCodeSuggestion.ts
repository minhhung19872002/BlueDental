import { useCallback, useEffect, useRef } from "react";
import type { FormInstance } from "antd";
import type { UseQueryResult } from "@tanstack/react-query";
import type { PatientCodeEstimate } from "../types/patient";
import type { PatientFormValues } from "../utils/patientEditorForm";

/**
 * "Mã khách hàng" offered again (BA 2026-11-02): a new hồ sơ opens on the
 * smallest free number of the year, which the desk may keep or overwrite.
 *
 * Call it after the dialog's reset effect — the reset empties the box on open
 * and the suggestion has to land on top of that. A suggestion that arrives
 * late only replaces the box while it is empty or still holds the previous
 * one, so a number the desk has typed is never overwritten.
 */
export function usePatientCodeSuggestion(
  form: FormInstance<PatientFormValues>,
  active: boolean,
  estimate: UseQueryResult<PatientCodeEstimate>,
) {
  const offered = useRef<string | null>(null);

  const offer = useCallback(
    (sequence: string) => {
      const current = form.getFieldValue("codeSequence") ?? "";
      if (current !== "" && current !== offered.current) return;
      form.setFieldValue("codeSequence", sequence);
      offered.current = sequence;
    },
    [form],
  );

  useEffect(() => {
    if (!active) {
      offered.current = null;
      return;
    }
    if (estimate.data) offer(estimate.data.sequence);
  }, [active, estimate.data, offer]);

  /** Whether the box still holds the number this dialog offered. */
  const isOffered = useCallback((sequence: string) => sequence === offered.current, []);

  /**
   * The offered number was taken by another desk before the save: ask again
   * and put the next free one in the box. Returns the code now offered, or
   * null when the server could not be asked.
   */
  const advance = useCallback(async () => {
    const { data } = await estimate.refetch();
    if (!data) return null;
    form.setFieldValue("codeSequence", data.sequence);
    offered.current = data.sequence;
    return data.code;
  }, [estimate, form]);

  return { isOffered, advance };
}
