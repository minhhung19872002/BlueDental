import { useRef, useState } from "react";
import { Button, Checkbox, Modal, Popover, Tooltip } from "antd";
import {
  FileImageOutlined,
  TableOutlined,
  UnorderedListOutlined,
  ZoomInOutlined,
} from "@ant-design/icons";
import { t } from "@/lib/i18n";

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
 * See docs/clone/pages/patient-detail.md §Chẩn đoán & Tư vấn.
 */

interface Props {
  /** Images already on the record, offered by "Danh sách ảnh". */
  images: { id: string; name: string; url: string }[];
  /** Rows of the "Dữ liệu tư vấn" catalogue. */
  catalog: { id: string; name: string }[];
  onUpload: (files: File[]) => void;
}

export function PatientConsultingImagePanel({ images, catalog, onUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [shown, setShown] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const picked = [...(files ?? [])];
    if (picked.length > 0) onUpload(picked);
  };

  return (
    <div className="pd-image-panel">
      <div className="pd-image-tools">
        <Tooltip title={t("Thêm ảnh")} placement="right">
          <Button
            aria-label={t("Thêm ảnh")}
            icon={<ZoomInOutlined />}
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

      <div
        className={["pd-image-drop", dragging && "pd-image-drop--over"].filter(Boolean).join(" ")}
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
        {shown.length === 0 ? (
          <>
            <FileImageOutlined />
            <span>{t("Kéo ảnh vào hoặc bấm nút để tải lên")}</span>
          </>
        ) : (
          <div className="pd-image-shown">
            {images
              .filter((image) => shown.includes(image.id))
              .map((image) => (
                <img key={image.id} src={image.url} alt={image.name} />
              ))}
          </div>
        )}
      </div>

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

      <Modal
        open={listOpen}
        title={t("Chọn ảnh hiển thị")}
        width={1020}
        onCancel={() => setListOpen(false)}
        destroyOnHidden
        footer={
          <div className="pd-image-list-foot">
            <Button onClick={() => setShown(images.map((image) => image.id))}>
              {t("Chọn tất cả")}
            </Button>
            <Button type="primary" onClick={() => setListOpen(false)}>
              {t("Xong")}
            </Button>
          </div>
        }
      >
        {images.length === 0 ? (
          <div className="pd-image-list-empty">{t("Chưa có ảnh nào.")}</div>
        ) : (
          <Checkbox.Group
            className="pd-image-list-grid"
            value={shown}
            onChange={(next) => setShown(next as string[])}
          >
            {images.map((image) => (
              <Checkbox key={image.id} value={image.id}>
                <img src={image.url} alt={image.name} />
                <span>{image.name}</span>
              </Checkbox>
            ))}
          </Checkbox.Group>
        )}
      </Modal>
    </div>
  );
}
