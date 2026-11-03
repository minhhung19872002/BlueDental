import { useCallback, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import type { CameraAvailability } from "../../../hooks/useCameraAvailability";
import { useImageUploadPreview } from "../../../hooks/useImageUploadPreview";
import { usePatientImageGallery, type PatientImageGallery } from "../../../hooks/usePatientImageGallery";
import type { PatientImagePermissions } from "../../../hooks/usePatientImagePermissions";
import { usePatientImageReorder } from "../../../hooks/usePatientImageReorder";
import { usePatientImageUpload } from "../../../hooks/usePatientImageUpload";
import { CameraCaptureDialog } from "./CameraCaptureDialog";
import { PatientImageCaptureButton } from "./PatientImageCaptureButton";
import { PatientImageStageHeader } from "./PatientImageStageHeader";
import { PatientImageTimeline } from "./PatientImageTimeline";
import { PatientImageUploadButton } from "./PatientImageUploadButton";
import { PatientImageUploadDialog } from "./PatientImageUploadDialog";
import { PatientImageViewer } from "./PatientImageViewer";
import type { PatientImageStage } from "./patientImageStages";

interface Props {
  patientId: string;
  stage: PatientImageStage;
  /** The note search, already settled; empty shows every picture. */
  search: string;
  permissions: PatientImagePermissions;
  cameraAvailability: CameraAvailability;
  /** A picture is being deleted: dim the column until the feed comes back. */
  deleting: boolean;
  onDelete: (image: PatientImageViewModel) => void;
}

/** "50 ảnh · 2 ngày chụp"; the day count only once every page is in. */
function summaryOf(gallery: PatientImageGallery, search: string): string {
  if (search) return t("Patient:Image:SearchCount", gallery.total);
  if (gallery.hasMore) return t("Patient:Image:DayCount", gallery.total);
  return t("Patient:Image:StageCount", gallery.total, gallery.days.length);
}

function emptyTextOf(gallery: PatientImageGallery, search: string): string {
  if (gallery.isLoading) return t("Patient:Image:LoadingText");
  if (search) return t("Patient:Image:SearchEmpty");
  return t("Patient:Image:StageEmpty");
}

/**
 * One "Giai đoạn điều trị" of the Hình ảnh tab: its own feed, upload (through
 * the preview, one note for the batch) and camera — both filed under this
 * stage — drag-to-sort, and the viewer, which pages through this column only.
 */
export function PatientImageStageColumn({
  patientId,
  stage,
  search,
  permissions,
  cameraAvailability,
  deleting,
  onDelete,
}: Props) {
  const title = t(stage.labelKey);
  const gallery = usePatientImageGallery(patientId, stage.type, search);
  const upload = usePatientImageUpload(patientId, gallery.branchId, stage.type);
  const uploading = upload.progress !== null;
  const preview = useImageUploadPreview(upload.upload, title);
  const { reordering, reorder } = usePatientImageReorder(patientId, stage.type, search);

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  /** The viewer pages through the column in the order it is drawn. */
  const shown = useMemo(() => gallery.days.flatMap((day) => day.images), [gallery.days]);
  const viewingIndex = viewingId ? shown.findIndex((image) => image.id === viewingId) : -1;

  const handleView = useCallback((image: PatientImageViewModel) => setViewingId(image.id), []);
  const closeViewer = useCallback(() => setViewingId(null), []);

  const busy =
    (gallery.isFetching && !gallery.isLoading && !gallery.isLoadingMore) || uploading || reordering || deleting;

  return (
    <section
      className={`pi-stage pi-stage--${stage.modifier}`}
      aria-label={title}
      data-testid="patient-image-stage"
      data-stage={stage.modifier}
    >
      <PatientImageStageHeader step={stage.step} title={title} summary={summaryOf(gallery, search)}>
        {permissions.canUpload && (
          <>
            <PatientImageUploadButton progress={upload.progress} onPick={preview.pick} />
            <PatientImageCaptureButton
              availability={cameraAvailability}
              busy={uploading}
              onClick={() => setCapturing(true)}
            />
          </>
        )}
      </PatientImageStageHeader>

      <div className="pi-stage-body">
        <PatientImageTimeline
          days={gallery.days}
          emptyText={emptyTextOf(gallery, search)}
          isLoadingMore={gallery.isLoadingMore}
          busy={busy}
          sentinelRef={gallery.sentinelRef}
          canSort={permissions.canSort}
          canDelete={permissions.canDelete}
          onView={handleView}
          onDelete={onDelete}
          onReorder={reorder}
        />
      </div>

      {viewingIndex >= 0 && (
        <PatientImageViewer key={viewingId} images={shown} initialIndex={viewingIndex} onClose={closeViewer} />
      )}

      {preview.open && (
        <PatientImageUploadDialog
          stageLabel={title}
          pictures={preview.pictures}
          progress={upload.progress}
          onAdd={preview.pick}
          onRemove={preview.remove}
          onUpload={(note) => void preview.send(note)}
          onClose={preview.close}
        />
      )}

      {capturing && (
        <CameraCaptureDialog
          stageLabel={title}
          progress={upload.progress}
          onUpload={upload.upload}
          onClose={() => setCapturing(false)}
        />
      )}
    </section>
  );
}
