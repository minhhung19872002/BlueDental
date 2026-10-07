import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { STATUS_TONE } from "@/theme/statusPalette";
import {
  ACTIVITY_KIND,
  CONTACT_RESULT,
  TICKET_CHANNEL,
  TICKET_STATUS,
  type ActivityKind,
  type ContactResult,
  type TicketChannel,
  type TicketStatus,
} from "../api/ticketApi";

/** Không tiềm năng is closed for good: the shared palette has no grey, so it takes the muted tokens. */
const LOST_TONE = { bg: "var(--bd-bg-soft)", color: "var(--bd-muted)" };

/** Label key and chip colours per status, from the shared status palette. */
export const TICKET_STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; color: string }> = {
  [TICKET_STATUS.New]: { label: "Ticket:Status:New", ...STATUS_TONE.scheduled },
  [TICKET_STATUS.InCare]: { label: "Ticket:Status:InCare", ...STATUS_TONE.cancelled },
  [TICKET_STATUS.Booked]: { label: "Ticket:Status:Booked", ...STATUS_TONE.converted },
  [TICKET_STATUS.Arrived]: { label: "Ticket:Status:Arrived", ...STATUS_TONE.arrived },
  [TICKET_STATUS.NotPotential]: { label: "Ticket:Status:NotPotential", ...LOST_TONE },
};

export const CONTACT_RESULT_LABEL: Record<ContactResult, string> = {
  [CONTACT_RESULT.Interested]: "Ticket:Result:Interested",
  [CONTACT_RESULT.NoNeed]: "Ticket:Result:NoNeed",
  [CONTACT_RESULT.NoAnswer]: "Ticket:Result:NoAnswer",
  [CONTACT_RESULT.Unreachable]: "Ticket:Result:Unreachable",
  [CONTACT_RESULT.CallBack]: "Ticket:Result:CallBack",
};

export const CHANNEL_LABEL: Record<TicketChannel, string> = {
  [TICKET_CHANNEL.Manual]: "Ticket:Channel:Manual",
  [TICKET_CHANNEL.File]: "Ticket:Channel:File",
  [TICKET_CHANNEL.Website]: "Ticket:Channel:Website",
};

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  [ACTIVITY_KIND.Created]: "Ticket:Activity:Created",
  [ACTIVITY_KIND.Contact]: "Ticket:Activity:Contact",
  [ACTIVITY_KIND.StatusChanged]: "Ticket:Activity:StatusChanged",
  [ACTIVITY_KIND.Assigned]: "Ticket:Activity:Assigned",
  [ACTIVITY_KIND.Reoccurred]: "Ticket:Activity:Reoccurred",
  [ACTIVITY_KIND.Booked]: "Ticket:Activity:Booked",
  [ACTIVITY_KIND.AppointmentChanged]: "Ticket:Activity:AppointmentChanged",
  [ACTIVITY_KIND.Deleted]: "Ticket:Activity:Deleted",
  [ACTIVITY_KIND.Restored]: "Ticket:Activity:Restored",
};

/** Open = still worked on; Đã đến and Không tiềm năng are closed. Contacts may be logged on an open ticket. */
export function isOpenStatus(status: TicketStatus): boolean {
  return status !== TICKET_STATUS.Arrived && status !== TICKET_STATUS.NotPotential;
}

/** Not booked yet: only these may be booked or given up on — the server's Ticket rules. */
export function isUnbooked(status: TicketStatus): boolean {
  return status === TICKET_STATUS.New || status === TICKET_STATUS.InCare;
}

export function contactResultOptions(): { value: ContactResult; label: string }[] {
  return Object.values(CONTACT_RESULT).map((value) => ({ value, label: t(CONTACT_RESULT_LABEL[value]) }));
}

/**
 * The server's TicketPhone.Normalize, for the form's own message: drop spaces,
 * dots, dashes and brackets, turn +84 / 84 into 0, then 10–11 digits from 0.
 */
export function isValidTicketPhone(raw: string): boolean {
  let digits = raw.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+84")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("84") && digits.length === 11) digits = `0${digits.slice(2)}`;
  return /^0\d{9,10}$/.test(digits);
}

/** The colours a tag may take — picked from swatches, so no free hex input. */
export const TAG_COLORS = [
  "#6366f1",
  "#0e94d0",
  "#0e9f6e",
  "#d98b0f",
  "#e5484d",
  "#7c5ce0",
  "#bf5a8c",
  "#5c6484",
] as const;

/** Date and minute, the way the ticket list prints every time. */
export const formatTicketTime = (value?: string | null) => (value ? dayjs(value).format("DD/MM/YYYY HH:mm") : null);
