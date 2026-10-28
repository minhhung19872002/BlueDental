import { useCallback, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { shrinkImageFile } from "@/utils/shrinkImageFile";
import { validateImageFile } from "@/utils/validateImageFile";
import {
  PATIENT_IMAGE_TYPE,
  usePatientImageBatchUpload,
  type PatientImageType,
} from "../api/patientImageApi";

/**
 * The heaviest picture "Tải ảnh" / "Chụp ảnh" accept — the server's own
 * ceiling (PatientImage.MaxSizeBytes). Anything over 1600px or 5 MB is shrunk
 * before it is sent, so what goes up is far lighter.
 */
export const PATIENT_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

/** How many refused file names one toast lists before it only counts the rest. */
const NAMED_REFUSALS = 3;

export interface UploadProgress {
  /** 1-based position of the file on its way up. */
  sending: number;
  total: number;
}

export interface PatientImageUpload {
  /** How far the batch has got; `null` while nothing is being sent. */
  progress: UploadProgress | null;
  /** Resolves to the files that reached the server — none of the refused or unsent ones. */
  upload: (files: File[]) => Promise<File[]>;
}

interface Refusal {
  file: File;
  error: string;
}

/** One toast per reason files were turned away, naming the first few. */
function reportRefusals(refusals: Refusal[]): void {
  const namesByError = new Map<string, string[]>();
  for (const { file, error } of refusals) {
    namesByError.set(error, [...(namesByError.get(error) ?? []), file.name]);
  }
  namesByError.forEach((names, error) => {
    const named = names.slice(0, NAMED_REFUSALS).join(", ");
    const unnamed = names.length - NAMED_REFUSALS;
    toast.error(error, {
      description: unnamed > 0 ? t("Patient:Photo:RefusedMore", named, unnamed) : named,
    });
  });
}

/**
 * "Tải ảnh" and "Chụp ảnh": any number of files, each scaled down on the
 * client, then sent one at a time, tagged with whichever "Giai đoạn điều trị"
 * the tab is filtered to (or "Trước điều trị" when it is not). One failure
 * stops the batch and says how far it got; the files already sent stay sent.
 * The feed is refreshed once, when the batch is over.
 */
export function usePatientImageUpload(
  patientId: string,
  clinicBranchId: string,
  filter: PatientImageType | null,
): PatientImageUpload {
  const { send, refresh } = usePatientImageBatchUpload();
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const upload = useCallback(
    async (files: File[]) => {
      const type = filter ?? PATIENT_IMAGE_TYPE.before;
      const refusals: Refusal[] = [];
      const valid = files.filter((file) => {
        const error = validateImageFile(file, PATIENT_IMAGE_MAX_BYTES);
        if (error) refusals.push({ file, error });
        return !error;
      });
      reportRefusals(refusals);
      if (valid.length === 0) return [];

      const sent: File[] = [];
      try {
        for (const file of valid) {
          setProgress({ sending: sent.length + 1, total: valid.length });
          const prepared = await shrinkImageFile(file);
          await send({ patientId, clinicBranchId, type, file: prepared });
          sent.push(file);
        }
      } catch {
        const failed = valid[sent.length];
        toast.error(
          valid.length === 1
            ? t("Patient:Photo:LoadError")
            : t("Patient:Photo:UploadStopped", failed?.name ?? "", sent.length, valid.length),
        );
      } finally {
        setProgress(null);
        if (sent.length > 0) void refresh();
      }
      return sent;
    },
    [patientId, clinicBranchId, filter, send, refresh],
  );

  return { progress, upload };
}
