import type { AppointmentOutcome, ReceptionItem } from "../types/reception";

export type StepAction = "check-in" | "start" | "complete";
export type NonNullOutcome = Exclude<AppointmentOutcome, null>;

/** What one click on a card asks the server for. */
export type ReceptionCommand =
  | { kind: "status"; action: StepAction; outcome?: NonNullOutcome }
  | { kind: "outcome"; outcome: NonNullOutcome };

/**
 * A click on the progress bar, and the outcome it ticks on the right.
 *
 * The bar and the outcome column describe the same visit, so they move
 * together: "Đang khám" ticks "Chuyển bác sĩ" and "Hoàn tất" ticks "Kết thúc
 * điều trị". An outcome that already says more — a booked follow-up, a revisit
 * — is left alone.
 */
export function planStepClick(item: ReceptionItem, action: StepAction): ReceptionCommand {
  const current = item.selectedOutcome ?? null;

  if (action === "start" && current === null) {
    return { kind: "status", action, outcome: "TransferDoctor" };
  }
  if (action === "complete" && current !== "FollowUp" && current !== "Revisit") {
    return { kind: "status", action, outcome: "EndTreatment" };
  }
  return { kind: "status", action };
}

/**
 * A click on an outcome, and how far it moves the progress bar.
 *
 * The reverse of {@link planStepClick}: "Chuyển bác sĩ" puts the visit in the
 * chair ("Đang khám"), "Kết thúc điều trị" finishes it ("Hoàn tất"). A bar
 * already past that point is not moved back; only the outcome is saved.
 * "Hẹn tái khám" keeps its own path: into the chair first, then done.
 * "Đã hẹn tiếp" does not come through here — it needs a date first.
 */
export function planOutcomeClick(item: ReceptionItem, outcome: NonNullOutcome): ReceptionCommand {
  const started = !!item.step2Time;
  const completed = !!item.step3Time;

  switch (outcome) {
    case "TransferDoctor":
      return started ? { kind: "outcome", outcome } : { kind: "status", action: "start", outcome };
    case "EndTreatment":
      return completed ? { kind: "outcome", outcome } : { kind: "status", action: "complete", outcome };
    case "Revisit":
      if (!started) return { kind: "status", action: "start", outcome };
      if (!completed) return { kind: "status", action: "complete", outcome };
      return { kind: "outcome", outcome };
    case "FollowUp":
      return { kind: "outcome", outcome };
  }
}
