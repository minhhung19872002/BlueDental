/**
 * How a printed sheet names a doctor: the Chức danh on their staff record, and
 * their name only when none is set (owner, 2026-10-19). Screens keep the name.
 */
export function printedDoctorName(
  name: string | null | undefined,
  jobTitle: string | null | undefined,
): string | null {
  return jobTitle?.trim() || name || null;
}
