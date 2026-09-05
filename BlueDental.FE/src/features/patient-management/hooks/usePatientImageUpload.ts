import { useCallback, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { shrinkImageFile } from "@/utils/shrinkImageFile";
import {
  PATIENT_IMAGE_TYPE,
  useUploadPatientImage,
  type PatientImageType,
} from "../api/patientImageApi";

/** The reference takes at most ten files per pick; extras are dropped with a toast. */
export const UPLOAD_BATCH_LIMIT = 10;

export interface PatientImageUpload {
  uploading: boolean;
  upload: (files: File[]) => Promise<void>;
}

/**
 * "Tải ảnh": each file is scaled down on the client, then sent one at a time,
 * tagged with whichever "Giai đoạn điều trị" the tab is filtered to (or
 * "Trước điều trị" when it is not). One failure stops the batch and says so;
 * the files already sent stay sent.
 */
export function usePatientImageUpload(
  patientId: string,
  clinicBranchId: string,
  filter: PatientImageType | null,
): PatientImageUpload {
  const mutation = useUploadPatientImage();
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      if (files.length > UPLOAD_BATCH_LIMIT) {
        toast.error(t("Chỉ tải được tối đa {0} ảnh mỗi lần", UPLOAD_BATCH_LIMIT));
      }
      const batch = files.slice(0, UPLOAD_BATCH_LIMIT);
      const type = filter ?? PATIENT_IMAGE_TYPE.before;

      setUploading(true);
      try {
        for (const file of batch) {
          const prepared = await shrinkImageFile(file);
          await mutation.mutateAsync({ patientId, clinicBranchId, type, file: prepared });
        }
      } catch {
        toast.error(t("Không thể tải ảnh"));
      } finally {
        setUploading(false);
      }
    },
    [patientId, clinicBranchId, filter, mutation],
  );

  return { uploading, upload };
}
