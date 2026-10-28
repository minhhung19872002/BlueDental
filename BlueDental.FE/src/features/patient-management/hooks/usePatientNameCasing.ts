import { useEffect, useRef } from "react";
import type { FormInstance } from "antd";
import { titleCaseName, type PatientFormValues } from "../utils/patientEditorForm";

/**
 * "IN HOA" is a switch on the name, not a separate value — the reference
 * rewrites the field the moment it is ticked and keeps it shouting as more is
 * typed, then puts it back when the tick is cleared.
 *
 * Normalising only on the *transition* matters: doing it on every keystroke
 * would fight the front desk as they type a name in their own casing.
 */
export function usePatientNameCasing(form: FormInstance<PatientFormValues>, uppercase: boolean, fullName: string) {
  const wasUppercase = useRef(uppercase);

  useEffect(() => {
    const justCleared = wasUppercase.current && !uppercase;
    wasUppercase.current = uppercase;

    const current = (form.getFieldValue("fullName") as string | undefined) ?? "";
    if (!current) return;

    if (uppercase) {
      const shouted = current.toLocaleUpperCase("vi");
      if (shouted !== current) form.setFieldValue("fullName", shouted);
      return;
    }

    if (justCleared) {
      const normalised = titleCaseName(current);
      if (normalised !== current) form.setFieldValue("fullName", normalised);
    }
  }, [uppercase, fullName, form]);
}
