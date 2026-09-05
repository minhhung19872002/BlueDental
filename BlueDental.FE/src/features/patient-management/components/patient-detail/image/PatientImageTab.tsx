import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import { useDeletePatientImage } from "../../../api/patientImageApi";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import { usePatientImageGallery } from "../../../hooks/usePatientImageGallery";
import { usePatientImagePermissions } from "../../../hooks/usePatientImagePermissions";
import { usePatientImageReorder } from "../../../hooks/usePatientImageReorder";
import { usePatientImageUpload } from "../../../hooks/usePatientImageUpload";
import { PatientImageTimeline } from "./PatientImageTimeline";
import { PatientImageToolbar } from "./PatientImageToolbar";
import { PatientImageViewer } from "./PatientImageViewer";

interface Props {
  patientId: string;
}

/**
 * Tab "Hình ảnh" of the patient record: the filter bar, the day-by-day
 * timeline of photographs, and the viewer / delete confirmation they open.
 * See docs/clone/pages/patient-detail.md, Tab 5.
 */
export function PatientImageTab({ patientId }: Props) {
  const gallery = usePatientImageGallery(patientId);
  const permissions = usePatientImagePermissions();
  const upload = usePatientImageUpload(patientId, gallery.branchId, gallery.filter);
  const { reordering, reorder } = usePatientImageReorder(patientId, gallery.filter);
  const deleteImage = useDeletePatientImage();

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<PatientImageViewModel | null>(null);

  /** The viewer pages through every image on screen, in the order it is drawn. */
  const shown = useMemo(() => gallery.days.flatMap((day) => day.images), [gallery.days]);
  const viewingIndex = viewingId ? shown.findIndex((image) => image.id === viewingId) : -1;

  const handleView = useCallback((image: PatientImageViewModel) => setViewingId(image.id), []);
  const closeViewer = useCallback(() => setViewingId(null), []);

  const handleDelete = async () => {
    if (!removing) return;
    try {
      await deleteImage.mutateAsync(removing.id);
      toast.success(t("Đã xoá ảnh"));
      setRemoving(null);
    } catch {
      toast.error(t("Không thể xoá ảnh"));
    }
  };

  const busy =
    (gallery.isFetching && !gallery.isLoading && !gallery.isLoadingMore) ||
    upload.uploading ||
    reordering ||
    deleteImage.isPending;

  return (
    <div className="pi-tab" data-testid="patient-image-tab">
      <PatientImageToolbar
        filter={gallery.filter}
        uploading={upload.uploading}
        canUpload={permissions.canUpload}
        onFilterChange={gallery.setFilter}
        onClearFilter={gallery.clearFilter}
        onUpload={upload.upload}
      />

      <PatientImageTimeline
        days={gallery.days}
        isLoading={gallery.isLoading}
        isLoadingMore={gallery.isLoadingMore}
        busy={busy}
        sentinelRef={gallery.sentinelRef}
        canSort={permissions.canSort}
        canDelete={permissions.canDelete}
        onView={handleView}
        onDelete={setRemoving}
        onReorder={reorder}
      />

      {viewingIndex >= 0 && (
        <PatientImageViewer key={viewingId} images={shown} initialIndex={viewingIndex} onClose={closeViewer} />
      )}

      <ConfirmDeleteDialog
        open={removing !== null}
        noun={t("ảnh")}
        title={t("Xác nhận xoá ảnh")}
        question={t("Bạn có chắc muốn xoá ảnh này không?")}
        pending={deleteImage.isPending}
        onConfirm={handleDelete}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
}
