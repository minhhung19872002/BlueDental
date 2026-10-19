import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { UPLOAD_BATCH_LIMIT } from "./usePatientImageUpload";

export interface CapturedShot {
  id: number;
  file: File;
  /** An object URL for the thumbnail; released when the shot is dropped. */
  url: string;
}

/** "chup-anh-20261019-143005-2.jpg" — the clock plus the shot's place in the session. */
function shotFileName(sequence: number): string {
  return `chup-anh-${dayjs().format("YYYYMMDD-HHmmss")}-${sequence}.jpg`;
}

/**
 * The pictures taken in one "Chụp ảnh" session, waiting to be uploaded — at
 * most as many as one upload takes. Thumbnails are object URLs, released as
 * shots are dropped and when the dialog goes away.
 */
export function useCapturedShots() {
  const [shots, setShots] = useState<CapturedShot[]>([]);
  const taken = useRef(0);
  const latest = useRef(shots);

  useEffect(() => {
    latest.current = shots;
  }, [shots]);

  useEffect(() => () => latest.current.forEach((shot) => URL.revokeObjectURL(shot.url)), []);

  const add = useCallback((blob: Blob) => {
    taken.current += 1;
    const file = new File([blob], shotFileName(taken.current), { type: "image/jpeg" });
    const shot = { id: taken.current, file, url: URL.createObjectURL(file) };
    setShots((current) => [...current, shot]);
  }, []);

  const discard = useCallback((gone: CapturedShot[]) => {
    if (gone.length === 0) return;
    gone.forEach((shot) => URL.revokeObjectURL(shot.url));
    const ids = new Set(gone.map((shot) => shot.id));
    setShots((current) => current.filter((shot) => !ids.has(shot.id)));
  }, []);

  const remove = useCallback((shot: CapturedShot) => discard([shot]), [discard]);

  return {
    shots,
    full: shots.length >= UPLOAD_BATCH_LIMIT,
    add,
    remove,
    discard,
  };
}
