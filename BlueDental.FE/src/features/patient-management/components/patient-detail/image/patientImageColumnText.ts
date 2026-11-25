import { t } from "@/lib/i18n";
import type { PatientImageGallery } from "../../../hooks/usePatientImageGallery";

/** "50 ảnh · 2 ngày chụp"; the day count only once every page is in. Inside a thư mục: "Trước điều trị · 5 ảnh". */
export function summaryOf(gallery: PatientImageGallery, search: string, folderStage: string | null): string {
  if (search) return t("Patient:Image:SearchCount", gallery.total);
  if (folderStage) return t("Patient:Image:FolderIn", folderStage, gallery.total);
  if (gallery.hasMore) return t("Patient:Image:DayCount", gallery.total);
  return t("Patient:Image:StageCount", gallery.total, gallery.days.length);
}

/** Null at a root whose thư mục are shown: they already say the column is not empty. */
export function emptyTextOf(gallery: PatientImageGallery, search: string, inFolder: boolean, folderCount: number): string | null {
  if (gallery.isLoading) return t("Patient:Image:LoadingText");
  if (search) return t("Patient:Image:SearchEmpty");
  if (inFolder) return t("Patient:Image:FolderEmptyText");
  if (folderCount > 0) return null;
  return t("Patient:Image:StageEmpty");
}
