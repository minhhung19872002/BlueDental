import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Spin, Tooltip } from "antd";
import {
  FileImageOutlined,
  TableOutlined,
  UnorderedListOutlined,
  ZoomInOutlined,
} from "@ant-design/icons";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { validateImageFile, IMAGE_ACCEPT } from "@/utils/validateImageFile";
import {
  groupImagesByDay,
  type PatientImageDay,
  type PatientImageViewModel,
} from "../../api/patientImageAdapters";
import { ConsultingImagePicker } from "./ConsultingImagePicker";
import { PatientImageViewer } from "./image/PatientImageViewer";
import { ConsultingLibraryDialog } from "./library/ConsultingLibraryDialog";

/**
 * The image panel that fills the left half of Chẩn đoán & Tư vấn.
 *
 * Three stacked commands sit over a drop zone, exactly as the reference has
 * them — a file picker, a "which images do I show" dialog and the consulting
 * data catalogue. Their labels are the reference's own:
 *
 *   Thêm ảnh       → the OS file chooser
 *   Danh sách ảnh  → "Chọn ảnh hiển thị" (Chọn tất cả / Xong)
 *   Danh mục       → "Thư viện ảnh lâm sàng", the consulting-data library dialog
 *
 * Whatever is ticked in that dialog is stacked down the panel, and clicking one
 * opens the same full-screen viewer the Hình ảnh tab uses — zoom, rotate, flip,
 * annotate, thumbnails. See docs/clone/pages/patient-detail.md.
 */

interface Props {
  images: PatientImageViewModel[];
  /** Which branch's consulting data the library reads. */
  branchId: string | undefined;
  /**
   * The photographs are still being read. Held apart from "there are none":
   * this panel loads slower than the rest of the tab, and treating the two the
   * same flashed the grey "Kéo ảnh vào" box before the pictures arrived.
   */
  loading?: boolean;
  uploading?: boolean;
  canSort: boolean;
  onUpload: (files: File[]) => void;
  onDelete?: (image: PatientImageViewModel) => void;
  onReorder: (day: PatientImageDay, from: number, to: number) => void;
}

export function PatientConsultingImagePanel({
  images,
  branchId,
  loading,
  uploading,
  canSort,
  onUpload,
  onDelete,
  onReorder,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  /**
   * Which pictures the browser has actually painted. The rows arrive long
   * before the files do, so a tile that only reserves its 240px reads as a
   * blank panel — it holds a shimmer until its own file lands.
   */
  const [painted, setPainted] = useState<string[]>([]);
  const markPainted = (id: string) =>
    setPainted((current) => (current.includes(id) ? current : [...current, id]));

  // Shown unless explicitly unticked, so a photograph just uploaded appears on
  // the panel straight away rather than waiting to be chosen — in the order
  // the dialog shows them, so a drag there is what the panel stacks by.
  const shown = useMemo(
    () =>
      groupImagesByDay(images)
        .flatMap((day) => day.images)
        .filter((image) => !hidden.includes(image.id)),
    [images, hidden],
  );
  const viewingIndex = viewingId ? shown.findIndex((image) => image.id === viewingId) : -1;

  // A deleted image must not stay on the hidden list, or its id would suppress
  // a later one that happens to reuse it.
  useEffect(() => {
    setHidden((current) => current.filter((id) => images.some((image) => image.id === id)));
  }, [images]);

  const handleFiles = (files: FileList | null) => {
    const picked = [...(files ?? [])].filter((file) => {
      const error = validateImageFile(file);
      if (error) toast.error(`${file.name}: ${error}`);
      return !error;
    });
    if (picked.length > 0) onUpload(picked);
  };

  const toggle = (id: string, checked: boolean) => {
    setHidden((current) => (checked ? current.filter((other) => other !== id) : [...current, id]));
  };

  // The whole panel takes a drop, so dragging over the photographs uploads
  // just as dragging onto the empty zone does.
  const panelClass = ["pd-image-panel", dragging && "pd-image-panel--over"]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={panelClass}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="pd-image-tools">
        <Tooltip title={t("Thêm ảnh")} placement="right">
          <Button
            aria-label={t("Thêm ảnh")}
            icon={<ZoomInOutlined />}
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          />
        </Tooltip>

        <Tooltip title={t("Danh sách ảnh")} placement="right">
          <Button
            aria-label={t("Danh sách ảnh")}
            icon={<TableOutlined />}
            onClick={() => setListOpen(true)}
          />
        </Tooltip>

        <Tooltip title={t("Danh mục")} placement="right">
          <Button
            aria-label={t("Danh mục")}
            icon={<UnorderedListOutlined />}
            onClick={() => setLibraryOpen(true)}
          />
        </Tooltip>
      </div>

      {/* The empty zone gives way to the photographs once there are any: the
          reference stacks them from the top, under the three commands.

          While the read is still in flight the same box holds a spinner: this
          panel is the slowest thing on the tab, and offering "Kéo ảnh vào" to a
          record that does have photographs reads as an empty record. */}
      {shown.length === 0 && (
        <div
          className={["pd-image-drop", dragging && "pd-image-drop--over"].filter(Boolean).join(" ")}
        >
          {loading || uploading ? (
            <Spin aria-label={t("Đang tải ảnh")} />
          ) : (
            <>
              <FileImageOutlined />
              <span>{t("Kéo ảnh vào hoặc bấm nút để tải lên")}</span>
            </>
          )}
        </div>
      )}

      {shown.length > 0 && (
        <div className="pd-image-shown">
          {shown.map((image) => (
            <button
              key={image.id}
              type="button"
              className={["pd-image-tile", !painted.includes(image.id) && "pd-image-tile--loading"]
                .filter(Boolean)
                .join(" ")}
              aria-label={t("Xem ảnh {0}", image.fileName)}
              onClick={() => setViewingId(image.id)}
            >
              {/* Chrome hands a photograph dragged off the page back through
                  dataTransfer.files, so dropping it on the panel it just left
                  reads as a file drop and uploads a duplicate (R-323).

                  onError counts as painted too: a picture the store cannot
                  serve would otherwise shimmer for good. */}
              <img
                src={image.url}
                alt={image.fileName}
                draggable={false}
                onLoad={() => markPainted(image.id)}
                onError={() => markPainted(image.id)}
              />
            </button>
          ))}
        </div>
      )}

      {viewingIndex >= 0 && (
        <PatientImageViewer
          key={viewingId}
          images={shown}
          initialIndex={viewingIndex}
          onClose={() => setViewingId(null)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <ConsultingLibraryDialog
        open={libraryOpen}
        branchId={branchId}
        imageCount={shown.length}
        onClose={() => setLibraryOpen(false)}
      />

      <ConsultingImagePicker
        open={listOpen}
        images={images}
        hidden={hidden}
        canSort={canSort}
        onToggle={toggle}
        onShowAll={() => setHidden([])}
        onClose={() => setListOpen(false)}
        onDelete={onDelete}
        onReorder={onReorder}
      />
    </div>
  );
}
