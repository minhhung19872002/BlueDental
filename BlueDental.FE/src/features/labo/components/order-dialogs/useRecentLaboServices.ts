import { useCallback, useState } from "react";

const STORAGE_KEY = "bd.labo.recentServices";
const KEEP = 3;

function readStored(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(0, KEEP) : [];
  } catch {
    // No storage (private window, blocked site data): the popup simply has no recent line.
    return [];
  }
}

function writeStored(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Kept for this visit only.
  }
}

/**
 * "Dùng gần đây" of the Chọn dịch vụ Labo popup (P3110 m158): the last three
 * services this browser picked, newest first. A per-viewer convenience only —
 * nothing on the server depends on it.
 */
export function useRecentLaboServices() {
  const [recent, setRecent] = useState(readStored);

  const remember = useCallback((id: string) => {
    setRecent((current) => {
      const next = [id, ...current.filter((one) => one !== id)].slice(0, KEEP);
      writeStored(next);
      return next;
    });
  }, []);

  return { recent, remember };
}
