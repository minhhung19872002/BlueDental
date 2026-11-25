import { useCallback, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import type { CameraAvailability } from "../../../hooks/useCameraAvailability";
import { useImageUploadPreview } from "../../../hooks/useImageUploadPreview";
import { usePatientImageFolderBrowser } from "../../../hooks/usePatientImageFolderBrowser";
import { usePatientImageFolderEditor } from "../../../hooks/usePatientImageFolderEditor";
import { usePatientImageFolderRemoval } from "../../../hooks/usePatientImageFolderRemoval";
import { usePatientImageGallery } from "../../../hooks/usePatientImageGallery";
import { usePatientImageMarquee } from "../../../hooks/usePatientImageMarquee";
import type { PatientImagePermissions } from "../../../hooks/usePatientImagePermissions";
import { usePatientImageReorder } from "../../../hooks/usePatientImageReorder";
import type { PatientImageSelection } from "../../../hooks/usePatientImageSelection";
import { usePatientImageUpload } from "../../../hooks/usePatientImageUpload";
import { CameraCaptureDialog } from "./CameraCaptureDialog";
import { ColumnSelectionProvider, tickStateOf, type ColumnSelection } from "./columnSelection";
import { PatientImageCaptureButton } from "./PatientImageCaptureButton";
import { PatientImageColumnSelectionHead } from "./PatientImageColumnSelectionHead";
import { PatientImageColumnTitle } from "./PatientImageColumnTitle";
import { PatientImageFolderDialogs } from "./PatientImageFolderDialogs";
import { PatientImageFolderGrid } from "./PatientImageFolderGrid";
import { emptyTextOf, summaryOf } from "./patientImageColumnText";
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

/**
 * One "Giai đoạn điều trị" of the Hình ảnh tab: its own feed, upload (through
 * the preview, one note for the batch) and camera — both filed under this
 * stage — drag-to-sort, the viewer, which pages through this column only, and
 * ticking pictures — one by one, or by sweeping a marquee over them — to
 * delete, download or move several at once. Its thư mục (F-98) sit above the
 * pictures that lie in none; one opened takes the column over.
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
  const browser = usePatientImageFolderBrowser(patientId, stage.type, selection);
  const folder = browser.openFolder;
  const folderId = folder?.id ?? null;
  /** Where an upload files to: "Trước điều trị / Răng cửa". */
  const place = folder ? `${title} / ${folder.name}` : title;
  const gallery = usePatientImageGallery(patientId, stage.type, search, folderId);
  const upload = usePatientImageUpload(patientId, gallery.branchId, stage.type, folderId);
  const uploading = upload.progress !== null;
  const preview = useImageUploadPreview(upload.upload, place);
  const { reordering, reorder } = usePatientImageReorder(patientId, stage.type, search, folderId);
  const editor = usePatientImageFolderEditor(patientId, gallery.branchId, stage.type);
  const removal = usePatientImageFolderRemoval();
  const showFolders = !folder && !search;

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  /** The viewer pages through the column in the order it is drawn; Shift+click ranges over it too. */
  const shown = useMemo(() => gallery.days.flatMap((day) => day.images), [gallery.days]);
  const viewingIndex = viewingId ? shown.findIndex((image) => image.id === viewingId) : -1;

  const handleView = useCallback((image: PatientImageViewModel) => setViewingId(image.id), []);
  const closeViewer = useCallback(() => setViewingId(null), []);

  const { toggle, setMany, isPicked } = selection;
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
        <PatientImageColumnSelectionHead
          stageType={stage.type}
          selection={selection}
          tick={columnTick}
          folders={browser.folders}
          currentFolderId={folderId}
          canMove={permissions.canSort}
          onDeleteMany={onDeleteMany}
        />
      ) : (
        <PatientImageColumnTitle
          stage={stage}
          folder={folder}
          summary={summaryOf(gallery, search, folder ? title : null)}
          onBack={browser.close}
          onNewFolder={permissions.canUpload && !folder ? editor.startCreate : undefined}
        >
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
        </PatientImageColumnTitle>
      )}

      <div ref={marquee.scrollRef} className="pi-stage-body" onPointerDown={marquee.onPointerDown}>
        <div ref={marquee.boxRef} className="pi-marquee" data-testid="patient-image-marquee" />
        {showFolders && (
          <PatientImageFolderGrid
            folders={browser.folders}
            canRename={permissions.canSort}
            canDelete={permissions.canDelete}
            onOpen={browser.open}
            onRename={editor.startRename}
            onDelete={removal.ask}
          />
        )}
        <ColumnSelectionProvider value={columnSelection}>
          <PatientImageTimeline
            days={gallery.days}
            emptyText={emptyTextOf(gallery, search, folder !== null, showFolders ? browser.folders.length : 0)}
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
          stageLabel={place}
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
          stageLabel={place}
          progress={upload.progress}
          onUpload={upload.upload}
          onClose={() => setCapturing(false)}
        />
      )}

      <PatientImageFolderDialogs editor={editor} removal={removal} />
    </section>
  );
}
