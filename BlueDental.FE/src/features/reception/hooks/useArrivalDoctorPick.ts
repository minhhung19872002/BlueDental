import { useCallback, useState } from "react";
import type { ArrivalDoctorPick } from "../types/arrivalCall";

const STORAGE_PREFIX = "bd_arrival_doctor_pick";

function isPick(value: unknown): value is ArrivalDoctorPick {
  if (typeof value !== "object" || value === null || !("all" in value)) return false;
  if (value.all === true) return true;
  return (
    value.all === false &&
    "doctorIds" in value &&
    Array.isArray(value.doctorIds) &&
    value.doctorIds.every((id) => typeof id === "string")
  );
}

/** What this browser stored, or null — never stored, unreadable, or storage blocked. */
function readPick(key: string | null): ArrivalDoctorPick | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPick(parsed) ? parsed : null;
  } catch {
    // Private window or blocked storage: fall back to the default pick.
    return null;
  }
}

function writePick(key: string | null, pick: ArrivalDoctorPick) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(pick));
  } catch {
    // Storage blocked: the pick still holds until the page reloads.
  }
}

interface UseArrivalDoctorPickArgs {
  userId: string | undefined;
  branchId: string | undefined;
  isAdmin: boolean;
}

/**
 * Whose arrived patients "Khách đã đến" shows, picked with the 👁 (R-1164,
 * owner 2026-11-06: per device). Kept in this browser per account and branch,
 * so a shared clinic PC keeps each doctor's own pick. Never picked: a doctor
 * sees their own patients, an admin every doctor's (owner 2026-11-02).
 */
export function useArrivalDoctorPick({ userId, branchId, isAdmin }: UseArrivalDoctorPickArgs) {
  const key = userId && branchId ? `${STORAGE_PREFIX}.${userId}.${branchId}` : null;
  const [stored, setStored] = useState(() => ({ key, pick: readPick(key) }));
  const storedPick = stored.key === key ? stored.pick : readPick(key);

  const fallback: ArrivalDoctorPick = isAdmin || !userId ? { all: true } : { all: false, doctorIds: [userId] };
  const pick = storedPick ?? fallback;

  const setPick = useCallback(
    (next: ArrivalDoctorPick) => {
      writePick(key, next);
      setStored({ key, pick: next });
    },
    [key],
  );

  return { pick, setPick };
}
