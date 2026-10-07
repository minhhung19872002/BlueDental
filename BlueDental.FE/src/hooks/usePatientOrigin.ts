import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_PREFIX = "bd.patientOrigin.";

/** A patient's record and everything under it (its treatment plans). */
const PATIENT_RECORD_PATH = /^\/patient\/([^/]+)/;

function patientIdOf(pathname: string): string | undefined {
  return PATIENT_RECORD_PATH.exec(pathname)?.[1];
}

/**
 * Remembers, per patient, the screen the record was opened from, so its
 * "Quay lại" goes back there — Tiếp nhận, Lịch hẹn, CSKH, Labo, the search…
 * (owner 2026-10-08).
 *
 * Watched here rather than handed over by each link: the record's own tabs,
 * its plan pages and the branch sync in AppLayout all rewrite the URL and
 * would drop router state on the way. Moving around inside the same patient
 * keeps the first origin. Session storage, so a reload keeps it too.
 */
export function useTrackPatientOrigin(): void {
  const location = useLocation();
  const previous = useRef<{ pathname: string; search: string } | null>(null);

  useEffect(() => {
    const from = previous.current;
    previous.current = { pathname: location.pathname, search: location.search };

    const patientId = patientIdOf(location.pathname);
    if (!from || !patientId || patientIdOf(from.pathname) === patientId) return;
    try {
      sessionStorage.setItem(STORAGE_PREFIX + patientId, from.pathname + from.search);
    } catch {
      // Storage blocked: "Quay lại" falls back to the patient list.
    }
  }, [location.pathname, location.search]);
}

/** Where the record was opened from, or null when nothing was recorded. */
export function readPatientOrigin(patientId: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + patientId);
  } catch {
    return null;
  }
}
