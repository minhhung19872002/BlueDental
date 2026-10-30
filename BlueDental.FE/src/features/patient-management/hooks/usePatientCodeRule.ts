import { useMemo } from "react";
import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import { useCheckPatientCode } from "../api/patientQueries";

const DIGITS = /^\d+$/;

/**
 * "Mã khách hàng" is typed by the desk rather than suggested (BA 2026-10-29):
 * once the box loses focus, prefix and digits are checked against every
 * record — the rule the save applies — and a taken code is flagged under the
 * box. Typing again clears the flag until the next blur; the save still
 * refuses a code someone took in between.
 */
export function usePatientCodeRule(prefix: string, excludeId?: string): Rule {
  const checkCode = useCheckPatientCode();

  return useMemo(
    () => ({
      validateTrigger: "onBlur",
      validator: async (_, sequence: string | undefined) => {
        const typed = sequence?.trim() ?? "";
        // Blank is left to the server; non-digits are the pattern rule's to report.
        if (!DIGITS.test(typed)) return;

        const { exists } = await checkCode(`${prefix}${typed}`, excludeId);
        if (exists) throw new Error(t("Patient:Form:CodeTaken"));
      },
    }),
    [checkCode, prefix, excludeId],
  );
}
