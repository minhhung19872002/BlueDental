import { useCallback, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { useImagePreviews, type ImagePreview } from "./useImagePreviews";
import { acceptImageFiles, type PatientImageUpload } from "./usePatientImageUpload";

export interface ImageUploadPreview {
  open: boolean;
  pictures: ImagePreview[];
  /** Files from the chooser: the acceptable ones join the preview, which opens. */
  pick: (files: File[]) => void;
  remove: (picture: ImagePreview) => void;
  /** Sends every picture with the one note; what went up leaves the preview. */
  send: (note: string) => Promise<void>;
  /** Drops whatever is still waiting and closes. */
  close: () => void;
}

/**
 * The step between the file chooser and the upload: the picked pictures are
 * shown, can be taken back or added to, and go up together under one "Ghi
 * chú". When every one of them reached the server the preview closes; after a
 * failure it stays with the ones that did not, so they can be sent again.
 */
export function useImageUploadPreview(upload: PatientImageUpload["upload"], stageLabel: string): ImageUploadPreview {
  const { items, add, remove, discard } = useImagePreviews();
  const [open, setOpen] = useState(false);

  const pick = useCallback(
    (files: File[]) => {
      const accepted = acceptImageFiles(files);
      if (accepted.length === 0) return;
      add(accepted);
      setOpen(true);
    },
    [add],
  );

  const send = async (note: string) => {
    const batch = items;
    const sent = new Set(await upload(batch.map((picture) => picture.file), note));
    discard(batch.filter((picture) => sent.has(picture.file)));
    if (sent.size > 0) toast.success(t("Patient:Image:UploadedTo", sent.size, stageLabel));
    if (sent.size === batch.length) setOpen(false);
  };

  const close = () => {
    discard(items);
    setOpen(false);
  };

  return { open, pictures: items, pick, remove, send, close };
}
