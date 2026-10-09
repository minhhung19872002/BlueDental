import type { CreateServiceCounterInput, ServiceCounter } from "../types";

export interface CounterFormValues {
  name: string;
  dentistId: string | null;
  numberPrefix: string;
  startNumber: number;
  minutesPerPatient: number;
  waitWarningMinutes: number;
  autoResetDaily: boolean;
}

/** Same defaults as BlueDental.Queue.ServiceCounter. */
export const NEW_COUNTER_VALUES: CounterFormValues = {
  name: "",
  dentistId: null,
  numberPrefix: "",
  startNumber: 1,
  minutesPerPatient: 12,
  waitWarningMinutes: 30,
  autoResetDaily: true,
};

/** One or two letters or digits — the server refuses anything else. */
export const PREFIX_PATTERN = /^[A-Z0-9]{1,2}$/;
export const MAX_COUNTER_NAME = 50;

export function toCounterFormValues(counter: ServiceCounter | null): CounterFormValues {
  if (!counter) return NEW_COUNTER_VALUES;
  return {
    name: counter.name,
    dentistId: counter.dentistId ?? null,
    numberPrefix: counter.numberPrefix,
    startNumber: counter.startNumber,
    minutesPerPatient: counter.minutesPerPatient,
    waitWarningMinutes: counter.waitWarningMinutes,
    autoResetDaily: counter.autoResetDaily,
  };
}

export function toCounterInput(
  values: CounterFormValues,
  sortOrder: number,
): CreateServiceCounterInput {
  return {
    ...values,
    name: values.name.trim(),
    numberPrefix: values.numberPrefix.trim().toUpperCase(),
    dentistId: values.dentistId ?? null,
    sortOrder,
  };
}

/** "A001": how the first number of a run reads on the ticket and the TV. */
export function previewNumber(
  prefix: string | undefined,
  start: number | null | undefined,
): string {
  const number = Math.max(1, Math.trunc(start ?? 1));
  return `${(prefix ?? "").trim().toUpperCase()}${String(number).padStart(3, "0")}`;
}
