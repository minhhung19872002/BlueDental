import { QueueTicketStatus, type QueueTicket } from "../types";

const DEFAULT_THRESHOLD = 30;

export type WaitingLevel = "normal" | "warning" | "danger";

export function getElapsedMinutes(ticket: QueueTicket): number | null {
  if (
    ticket.status !== QueueTicketStatus.Waiting &&
    ticket.status !== QueueTicketStatus.Called
  ) {
    return null;
  }
  return Math.floor(
    (Date.now() - new Date(ticket.creationTime).getTime()) / 60_000,
  );
}

export function formatElapsed(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function getWaitingLevel(
  ticket: QueueTicket,
  thresholdMinutes = DEFAULT_THRESHOLD,
): WaitingLevel {
  const elapsed = getElapsedMinutes(ticket);
  if (elapsed === null || elapsed < thresholdMinutes) return "normal";
  if (elapsed >= thresholdMinutes * 2) return "danger";
  return "warning";
}

export function getWaitingRowClass(
  ticket: QueueTicket,
  thresholdMinutes = DEFAULT_THRESHOLD,
): string {
  const level = getWaitingLevel(ticket, thresholdMinutes);
  if (level === "warning") return "queue-row--warning";
  if (level === "danger") return "queue-row--danger";
  return "";
}
