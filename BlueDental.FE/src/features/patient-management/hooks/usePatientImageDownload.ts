import { useCallback } from "react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { downloadBlob } from "@/utils/download";
import { zipFiles } from "@/utils/zipFiles";
import { useFetchPatientImageFiles } from "../api/patientImageApi";
import type { PatientImageViewModel } from "../api/patientImageAdapters";

/**
 * The selection's "Tải xuống": one picture is saved as itself, under its own
 * file name; two or more go into one .zip.
 */
export function usePatientImageDownload() {
  const fetchFiles = useFetchPatientImageFiles();
  const { mutateAsync } = fetchFiles;

  const download = useCallback(
    async (images: PatientImageViewModel[]) => {
      if (images.length === 0) return;
      try {
        const files = await mutateAsync(images.map(({ id, fileName }) => ({ id, fileName })));
        if (files.length === 1) {
          downloadBlob(files[0].blob, files[0].fileName);
          return;
        }
        const zip = await zipFiles(files);
        downloadBlob(zip, `${t("Patient:Image:ZipName", dayjs().format("YYYYMMDD-HHmmss"))}.zip`);
      } catch (error) {
        toast.error(extractApiError(error) || t("Patient:Image:DownloadError"));
      }
    },
    [mutateAsync],
  );

  return { download, downloading: fetchFiles.isPending };
}
