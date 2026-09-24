import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { validateImageFile } from "@/utils/validateImageFile";

export interface LaboPictures {
  pictures: File[];
  /** One blob URL per draft, in the same order. */
  previews: string[];
  addPictures: (files: File[]) => void;
  removePicture: (index: number) => void;
  reset: () => void;
}

/**
 * The pictures a labo dialog holds as drafts until Lưu: the order forms and
 * the detail dialog share the same strip, the same file rule and the same
 * blob-URL bookkeeping.
 *
 * One blob URL per draft, revoked when the list changes or the dialog goes.
 * Minting them inside the render would hand out a fresh URL on every
 * keystroke in the form and never release any of them.
 */
export function useLaboPictures(): LaboPictures {
  const [pictures, setPictures] = useState<File[]>([]);

  const previews = useMemo(() => pictures.map((file) => URL.createObjectURL(file)), [pictures]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const addPictures = useCallback((files: File[]) => {
    const valid = files.filter((file) => {
      const error = validateImageFile(file);
      if (error) toast.error(`${file.name}: ${error}`);
      return !error;
    });
    if (valid.length > 0) setPictures((current) => [...current, ...valid]);
  }, []);

  const removePicture = useCallback(
    (index: number) => setPictures((current) => current.filter((_, at) => at !== index)),
    [],
  );

  const reset = useCallback(() => setPictures([]), []);

  return { pictures, previews, addPictures, removePicture, reset };
}
