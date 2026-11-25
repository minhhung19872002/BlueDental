import { useCallback, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import type { CameraAvailability } from "../../../hooks/useCameraAvailability";
import { useImageUploadPreview } from "../../../hooks/useImageUploadPreview";
import { usePatientImageDownload } from "../../../hooks/usePatientImageDownload";
import { usePatientImageGallery, type PatientImageGallery } from "../../../hooks/usePatientImageGallery";
import { usePatientImageMarquee } from "../../../hooks/usePatientImageMarquee";
import type { PatientImagePermissions } from "../../../hooks/usePatientImagePermissions";
import { usePatientImageReorder } from "../../../hooks/usePatientImageReorder";
import type { PatientImageSelection } from "../../../hooks/usePatientImageSelection";
import { usePatientImageUpload } from "../../../hooks/usePatientImageUpload";
import { CameraCaptureDialog } from "./CameraCaptureDialog";
import { ColumnSelectionProvider, tickStateOf, type ColumnSelection } from "./columnSelection";
import { PatientImageCaptureButton } from "./PatientImageCaptureButton";
import { PatientImageSelectionBar } from "./PatientImageSelectionBar";
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
  /** The tab's "chọn nhiều để xoá", one column at a time (R-1277). */
  selection: PatientImageSelection;
  onDeleteMany: () => void;
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
 * stage — drag-to-sort, the viewer, which pages through this column only, and
 * ticking pictures — one by one, or by sweeping a marquee over them — to
 * delete several at once.
 */
export function PatientImageStageColumn({
  patientId,
  stage,
  search,
  permissions,
  cameraAvailability,
  deleting,
  onDelete,
  selection,
  onDeleteMany,
}: Props) {
  const title = t(stage.labelKey);
  const gallery = usePatientImageGallery(patientId, stage.type, search);
  const upload = usePatientImageUpload(patientId, gallery.branchId, stage.type);
  const uploading = upload.progress !== null;
  const preview = useImageUploadPreview(upload.upload, title);
  const { reordering, reorder } = usePatientImageReorder(patientId, stage.type, search);
  const { download, downloading } = usePatientImageDownload();

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  /** The viewer pages through the column in the order it is drawn; Shift+click ranges over it too. */
  const shown = useMemo(() => gallery.days.flatMap((day) => day.images), [gallery.days]);
  const viewingIndex = viewingId ? shown.findIndex((image) => image.id === viewingId) : -1;

  const handleView = useCallback((image: PatientImageViewModel) => setViewingId(image.id), []);
  const closeViewer = useCallback(() => setViewingId(null), []);

  const { toggle, setMany, isPicked, clear } = selection;
  const selecting = selection.stage === stage.type;
  const columnSelection = useMemo<ColumnSelection>(
    () => ({
      enabled: permissions.canDelete,
      active: selecting,
      isPicked,
      toggle: (image, extend) => toggle(stage.type, image, shown, extend),
      setMany: (images, on) => setMany(stage.type, images, on),
    }),
    [permissions.canDelete, selecting, isPicked, toggle, setMany, stage.type, shown],
  );
  const columnTick = tickStateOf(shown, isPicked);
  const marquee = usePatientImageMarquee({ stage: stage.type, shown, selection, enabled: permissions.canDelete });

  const busy =
    (gallery.isFetching && !gallery.isLoading && !gallery.isLoadingMore) || uploading || reordering || deleting;

  return (
    <section
      className={`pi-stage pi-stage--${stage.modifier}`}
      aria-label={title}
      data-testid="patient-image-stage"
      data-stage={stage.modifier}
    >
      {selecting ? (
        <PatientImageSelectionBar
          count={selection.picked.length}
          all={columnTick.all}
          some={columnTick.some}
          onSelectAll={(on) => setMany(stage.type, columnTick.selectable, on)}
          onExit={clear}
        >
          <PatientImageSelectionBar.Download
            count={selection.picked.length}
            downloading={downloading}
            onDownload={() => void download(selection.picked)}
          />
          <PatientImageSelectionBar.Delete count={selection.picked.length} onDelete={onDeleteMany} />
        </PatientImageSelectionBar>
      ) : (
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
      )}

      <div ref={marquee.scrollRef} className="pi-stage-body" onPointerDown={marquee.onPointerDown}>
        <div ref={marquee.boxRef} className="pi-marquee" data-testid="patient-image-marquee" />
        <ColumnSelectionProvider value={columnSelection}>
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
        </ColumnSelectionProvider>
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
