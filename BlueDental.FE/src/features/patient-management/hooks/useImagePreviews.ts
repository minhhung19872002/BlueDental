import { useCallback, useEffect, useRef, useState } from "react";

export interface ImagePreview {
  id: number;
  file: File;
  /** An object URL for the thumbnail; released when the picture is dropped. */
  url: string;
}

/**
 * Pictures waiting to be uploaded, each with a thumbnail — the camera's shots
 * and the files "Tải ảnh" picked alike. Thumbnails are object URLs, released
 * as pictures are dropped and when the owner goes away.
 */
export function useImagePreviews() {
  const [items, setItems] = useState<ImagePreview[]>([]);
  const added = useRef(0);
  const latest = useRef(items);

  useEffect(() => {
    latest.current = items;
  }, [items]);

  useEffect(() => () => latest.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const add = useCallback((files: File[]) => {
    const next = files.map((file) => {
      added.current += 1;
      return { id: added.current, file, url: URL.createObjectURL(file) };
    });
    setItems((current) => [...current, ...next]);
  }, []);

  const discard = useCallback((gone: ImagePreview[]) => {
    if (gone.length === 0) return;
    gone.forEach((item) => URL.revokeObjectURL(item.url));
    const ids = new Set(gone.map((item) => item.id));
    setItems((current) => current.filter((item) => !ids.has(item.id)));
  }, []);

  const remove = useCallback((item: ImagePreview) => discard([item]), [discard]);

  return { items, add, remove, discard };
}
