import type { AppointmentDto } from "../../types/appointment";
import { STATUS_GROUPS } from "../../hooks/useStatusCounts";

/**
 * What the server sends as DentistId / PatientId on a "Lịch tạm" nobody has
 * been put on yet, and on a walk-in with no patient record (Guid.Empty).
 */
export const NO_ID = "00000000-0000-0000-0000-000000000000";

export interface TimelineDoctor {
  id: string;
  name: string;
}

export interface BookingFilter {
  keyword: string;
  doctorIds?: string[];
  statusFilter?: string;
}

/**
 * The bookings the timeline draws. BA 2026-10-03: "đã hủy không hiện ở đây" —
 * a cancelled booking frees its slot, so it takes no lane, keeps no doctor's
 * row and widens no hours. No-shows stay, greyed out.
 */
export function timelineBookings(dayBookings: AppointmentDto[]): AppointmentDto[] {
  return dayBookings.filter((a) => a.status !== "cancelled");
}

/** The toolbar's search, doctor and status-chip filters, applied to one day's bookings. */
export function filterBookings(bookings: AppointmentDto[], filter: BookingFilter): AppointmentDto[] {
  const needle = filter.keyword.trim().toLowerCase();
  const chipGroup = STATUS_GROUPS.find((g) => g.key === filter.statusFilter);
  const doctorIds = filter.doctorIds ?? [];

  return bookings.filter((a) => {
    if (doctorIds.length > 0 && !doctorIds.includes(a.doctorId)) return false;
    if (chipGroup && chipGroup.statuses.length > 0 && !chipGroup.statuses.includes(a.status)) return false;
    if (!needle) return true;
    return (
      a.patientName?.toLowerCase().includes(needle) ||
      a.reason?.toLowerCase().includes(needle) ||
      a.doctorName?.toLowerCase().includes(needle)
    );
  });
}

/**
 * One column per doctor working that day (`available` is already the list
 * without those registered OFF). A doctor who went OFF after being booked still
 * gets a column, so none of that day's bookings vanishes from the board. A
 * "Lịch tạm" with no doctor yet goes in a last column of its own (`NO_ID`),
 * shown only on days that have one and hidden once a doctor is picked.
 */
export function buildDoctorRows(
  available: TimelineDoctor[],
  dayBookings: AppointmentDto[],
  doctorIds?: string[],
): TimelineDoctor[] {
  const rows = [...available];
  const listed = new Set(available.map((d) => d.id));
  let unassigned = false;
  for (const booking of dayBookings) {
    if (!booking.doctorId || booking.doctorId === NO_ID) {
      unassigned = true;
      continue;
    }
    if (listed.has(booking.doctorId)) continue;
    listed.add(booking.doctorId);
    rows.push({ id: booking.doctorId, name: booking.doctorName });
  }

  if (!doctorIds || doctorIds.length === 0) return unassigned ? [...rows, { id: NO_ID, name: "" }] : rows;
  // The doctor picker never offers NO_ID, so picking anyone hides the unassigned column.
  const picked = new Set(doctorIds);
  return rows.filter((d) => picked.has(d.id));
}

export function groupByDoctor(bookings: AppointmentDto[]): Map<string, AppointmentDto[]> {
  const map = new Map<string, AppointmentDto[]>();
  for (const appt of bookings) {
    const key = appt.doctorId || NO_ID;
    const bucket = map.get(key);
    if (bucket) bucket.push(appt);
    else map.set(key, [appt]);
  }
  return map;
}

/**
 * A "Lịch tạm" has no record yet: the name it was booked under stands for the
 * person (owner 2026-10-16), letter case and extra spaces aside.
 */
function personKey(booking: AppointmentDto): string {
  if (booking.patientId && booking.patientId !== NO_ID) return booking.patientId;
  const name = booking.patientName?.trim().replace(/\s+/g, " ").toLowerCase();
  return name ? `name:${name}` : `booking:${booking.id}`;
}

/**
 * The badge beside a doctor's name (BA 2026-10-16): how many different
 * patients the column shows — the bookings left after the toolbar filters,
 * cancelled ones never among them, a patient booked twice counted once.
 */
export function patientCount(bookings: AppointmentDto[]): number {
  return new Set(bookings.map(personKey)).size;
}
