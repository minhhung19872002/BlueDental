import type { AppointmentDto } from "../../types/appointment";
import { STATUS_GROUPS } from "../../hooks/useStatusCounts";

export interface TimelineDoctor {
  id: string;
  name: string;
}

export interface BookingFilter {
  keyword: string;
  doctorIds?: string[];
  statusFilter?: string;
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
 * One row per doctor working that day (`available` is already the list without
 * those registered OFF). A doctor who went OFF after being booked still gets a
 * row, so none of that day's bookings vanishes from the board.
 */
export function buildDoctorRows(
  available: TimelineDoctor[],
  dayBookings: AppointmentDto[],
  doctorIds?: string[],
): TimelineDoctor[] {
  const rows = [...available];
  const listed = new Set(available.map((d) => d.id));
  for (const booking of dayBookings) {
    if (!booking.doctorId || listed.has(booking.doctorId)) continue;
    listed.add(booking.doctorId);
    rows.push({ id: booking.doctorId, name: booking.doctorName });
  }

  if (!doctorIds || doctorIds.length === 0) return rows;
  const picked = new Set(doctorIds);
  return rows.filter((d) => picked.has(d.id));
}

export function groupByDoctor(bookings: AppointmentDto[]): Map<string, AppointmentDto[]> {
  const map = new Map<string, AppointmentDto[]>();
  for (const appt of bookings) {
    const bucket = map.get(appt.doctorId);
    if (bucket) bucket.push(appt);
    else map.set(appt.doctorId, [appt]);
  }
  return map;
}
