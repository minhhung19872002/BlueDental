import { z } from "zod";
import { t } from "@/lib/i18n";
import { PATIENT_IMAGE_FOLDER_NAME_MAX } from "../../../api/patientImageFolderApi";

/**
 * A thư mục's name as the server keeps it (PatientImageFolder.NormalizeName):
 * trimmed, runs of spaces folded to one, 1–100 characters. Built on call, so
 * the messages follow the language in use.
 */
export function patientImageFolderNameSchema() {
  return z
    .string()
    .transform((name) => name.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, t("Patient:Image:FolderNameRequired"))
        .max(PATIENT_IMAGE_FOLDER_NAME_MAX, t("Patient:Image:FolderNameTooLong", PATIENT_IMAGE_FOLDER_NAME_MAX)),
    );
}
