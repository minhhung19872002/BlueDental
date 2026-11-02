import { useMemo } from "react";
import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import { useCheckPatientCode } from "../api/patientQueries";

const DIGITS = /^\d+$/;

/**
 * "Mã khách hàng" may be kept as offered or overwritten (BA 2026-11-02): once
 * the box loses focus, a number the desk typed is checked against every
 * record — the rule the save applies — and a taken code is flagged under the
 * box. Typing again clears the flag until the next blur.
 *
 * The offered number is not checked: it was free when offered, and if another
 * desk takes it first the save moves on to the next one and says so.
 */
export function usePatientCodeRule(
  prefix: string,
  excludeId?: string,
  isOffered?: (sequence: string) => boolean,
): Rule {
  const checkCode = useCheckPatientCode();

  return useMemo(
    () => ({
      validateTrigger: "onBlur",
      validator: async (_, sequence: string | undefined) => {
        const typed = sequence?.trim() ?? "";
        // Blank is left to the server; non-digits are the pattern rule's to report.
        if (!DIGITS.test(typed) || isOffered?.(typed)) return;

        const { exists } = await checkCode(`${prefix}${typed}`, excludeId);
        if (exists) throw new Error(t("Patient:Form:CodeTaken"));
      },
    }),
    [checkCode, prefix, excludeId, isOffered],
  );
}
