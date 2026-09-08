import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Popover, Spin, Tooltip } from "antd";
import {
  FileImageOutlined,
  TableOutlined,
  UnorderedListOutlined,
  ZoomInOutlined,
} from "@ant-design/icons";
import { t } from "@/lib/i18n";
import {
  groupImagesByDay,
  type PatientImageDay,
  type PatientImageViewModel,
} from "../../api/patientImageAdapters";
import { ConsultingImagePicker } from "./ConsultingImagePicker";
import { PatientImageViewer } from "./image/PatientImageViewer";

/**
 * The image panel that fills the left half of Chẩn đoán & Tư vấn.
 *
 * Three stacked commands sit over a drop zone, exactly as the reference has
 * them — a file picker, a "which images do I show" dialog and the consulting
 * data catalogue. Their labels are the reference's own:
 *
 *   Thêm ảnh       → the OS file chooser
 *   Danh sách ảnh  → "Chọn ảnh hiển thị" (Chọn tất cả / Xong)
 *   Danh mục       → "Dữ liệu tư vấn" popover, from the consulting_data group
 *
 * Whatever is ticked in that dialog is stacked down the panel, and clicking one
 * opens the same full-screen viewer the Hình ảnh tab uses — zoom, rotate, flip,
 * annotate, thumbnails. See docs/clone/pages/patient-detail.md.
 */

interface Props {
  images: PatientImageViewModel[];
  /** Rows of the "Dữ liệu tư vấn" catalogue. */
  catalog: { id: string; name: string }[];
  uploading?: boolean;
  canSort: boolean;
  onUpload: (files: File[]) => void;
  onDelete?: (image: PatientImageViewModel) => void;
  onReorder: (day: PatientImageDay, from: number, to: number) => void;
}

export function PatientConsultingImagePanel({
  images,
  catalog,
  uploading,
  canSort,
  onUpload,
  onDelete,
  onReorder,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

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
    const picked = [...(files ?? [])];
    if (picked.length > 0) onUpload(picked);
  };

  const toggle = (id: string, checked: boolean) => {
    setHidden((current) =>
      checked ? current.filter((other) => other !== id) : [...current, id],
    );
  };

  // The whole panel takes a drop, so dragging over the photographs uploads
  // just as dragging onto the empty zone does.
  const panelClass = ["pd-image-panel", dragging && "pd-image-panel--over"].filter(Boolean).join(" ");

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

        <Popover
          trigger="click"
          placement="rightTop"
          title={t("Dữ liệu tư vấn")}
          content={
            <ul className="pd-catalog-list">
              {catalog.length === 0 ? (
                <li className="pd-catalog-empty">{t("Không có danh mục.")}</li>
              ) : (
                catalog.map((row) => <li key={row.id}>{row.name}</li>)
              )}
            </ul>
          }
        >
          <Tooltip title={t("Danh mục")} placement="right">
            <Button aria-label={t("Danh mục")} icon={<UnorderedListOutlined />} />
          </Tooltip>
        </Popover>
      </div>

      {/* The empty zone gives way to the photographs once there are any: the
          reference stacks them from the top, under the three commands. */}
      {shown.length === 0 && (
        <div className={["pd-image-drop", dragging && "pd-image-drop--over"].filter(Boolean).join(" ")}>
          {uploading ? (
            <Spin />
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
              className="pd-image-tile"
              aria-label={t("Xem ảnh {0}", image.fileName)}
              onClick={() => setViewingId(image.id)}
            >
              <img src={image.url} alt={image.fileName} />
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
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
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
