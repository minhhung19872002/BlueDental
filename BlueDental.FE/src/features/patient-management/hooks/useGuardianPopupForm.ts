import { useCallback, useEffect, useState } from "react";
import { Form } from "antd";
import { t } from "@/lib/i18n";
import { GUARDIAN_LIMITS, type GuardianCandidate } from "../types/patient";
import {
  emptyGuardian,
  fillGuardianFromCandidate,
  type GuardianDraft,
  type GuardianGroup,
} from "../utils/guardian";
import type { GuardianPopupFocus } from "./usePatientGuardians";

interface FieldError {
  name: (string | number)[];
}

/** What `validateFields` rejects with: the fields that failed, by path. */
function failedFields(error: unknown): FieldError[] {
  if (typeof error !== "object" || error === null || !("errorFields" in error)) return [];
  const { errorFields } = error;
  return Array.isArray(errorFields) ? errorFields : [];
}

/** The guardian index a failed field path points into, e.g. ["guardians", 1, "phone"] → 1. */
function guardianIndexOf(field: FieldError): number | null {
  return field.name[0] === "guardians" && typeof field.name[1] === "number" ? field.name[1] : null;
}

/**
 * The "Thông tin người giám hộ" popup's working copy of the group.
 *
 * The popup edits its own AntD form, seeded from the hồ sơ dialog's group each
 * time it opens; `submit` hands back the edited copy, or null when something
 * is missing — the failing accordions are opened so the errors are on screen.
 */
export function useGuardianPopupForm(focus: GuardianPopupFocus | null, group: GuardianGroup) {
  const [form] = Form.useForm<GuardianGroup>();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const watched: GuardianDraft[] | undefined = Form.useWatch("guardians", { form, preserve: true });
  const guardians = watched ?? [];

  useEffect(() => {
    if (!focus) return;
    const seeded =
      focus.kind === "new" && group.guardians.length < GUARDIAN_LIMITS.maxPerPatient
        ? [...group.guardians, emptyGuardian(group.guardians.length === 0)]
        : group.guardians;
    form.resetFields();
    form.setFieldsValue({ guardians: seeded, consented: group.consented });

    const target = focus.kind === "new" ? seeded[seeded.length - 1] : seeded[focus.index];
    setActiveKeys(target ? [target.uid] : []);
  }, [focus, group, form]);

  const current = useCallback((): GuardianDraft[] => form.getFieldValue("guardians") ?? [], [form]);

  const add = useCallback(() => {
    const list = current();
    if (list.length >= GUARDIAN_LIMITS.maxPerPatient) return;
    const added = emptyGuardian(list.length === 0);
    form.setFieldValue("guardians", [...list, added]);
    setActiveKeys([added.uid]);
  }, [current, form]);

  const remove = useCallback(
    (index: number) => {
      const list = current().filter((_, i) => i !== index);
      if (list.length > 0 && !list.some((g) => g.isPrimaryContact)) {
        list[0] = { ...list[0], isPrimaryContact: true };
      }
      form.setFieldValue("guardians", list);
    },
    [current, form],
  );

  /** Exactly one primary contact: ticking one unticks the rest. */
  const setPrimary = useCallback(
    (index: number, checked: boolean) => {
      const list = current().map((g, i) => ({
        ...g,
        isPrimaryContact: checked ? i === index : i === index ? false : g.isPrimaryContact,
      }));
      form.setFieldValue("guardians", list);
      form.setFields(list.map((_, i) => ({ name: ["guardians", i, "isPrimaryContact"], errors: [] })));
    },
    [current, form],
  );

  const fillFrom = useCallback(
    (index: number, found: GuardianCandidate) => {
      const list = current();
      if (!list[index]) return;
      form.setFieldValue(["guardians", index], fillGuardianFromCandidate(list[index], found));
      void form.validateFields(
        ["fullName", "phone", "nationalId"].map((field) => ["guardians", index, field]),
      ).catch(() => undefined);
    },
    [current, form],
  );

  const submit = useCallback(async (): Promise<GuardianGroup | null> => {
    try {
      await form.validateFields();
    } catch (error) {
      const indices = failedFields(error).map(guardianIndexOf).filter((i): i is number => i !== null);
      const list = current();
      setActiveKeys(indices.map((i) => list[i]?.uid).filter((uid): uid is string => Boolean(uid)));
      return null;
    }

    const values: GuardianGroup = form.getFieldsValue(true);
    if (values.guardians.filter((g) => g.isPrimaryContact).length !== 1) {
      form.setFields(
        values.guardians.map((_, i) => ({
          name: ["guardians", i, "isPrimaryContact"],
          errors: [t("Patient:Guardian:PrimaryRequired")],
        })),
      );
      setActiveKeys(values.guardians.map((g) => g.uid));
      return null;
    }
    return { guardians: values.guardians, consented: values.consented };
  }, [current, form]);

  return { form, guardians, activeKeys, setActiveKeys, add, remove, setPrimary, fillFrom, submit };
}
