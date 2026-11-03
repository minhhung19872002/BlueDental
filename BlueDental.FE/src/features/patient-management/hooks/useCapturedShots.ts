import { useCallback, useRef } from "react";
import dayjs from "dayjs";
import { useImagePreviews, type ImagePreview } from "./useImagePreviews";

export type CapturedShot = ImagePreview;

/** "chup-anh-20261019-143005-2.jpg" — the clock plus the shot's place in the session. */
function shotFileName(sequence: number): string {
  return `chup-anh-${dayjs().format("YYYYMMDD-HHmmss")}-${sequence}.jpg`;
}

/**
 * The pictures taken in one "Chụp ảnh" session, waiting to be uploaded — as
 * many as the desk takes, named after the moment and their place in it.
 */
export function useCapturedShots() {
  const { items, add: addFiles, remove, discard } = useImagePreviews();
  const taken = useRef(0);

  const add = useCallback(
    (blob: Blob) => {
      taken.current += 1;
      addFiles([new File([blob], shotFileName(taken.current), { type: "image/jpeg" })]);
    },
    [addFiles],
  );

  return { shots: items, add, remove, discard };
}
