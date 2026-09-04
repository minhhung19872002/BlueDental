import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, Image, Modal, Popover, Spin, Tooltip } from "antd";
import {
  DeleteOutlined,
  FileImageOutlined,
  HolderOutlined,
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
 * Whatever is ticked in that dialog is stacked down the panel, and clicking one
 * opens it full size. See docs/clone/pages/patient-detail.md §Chẩn đoán & Tư vấn.
 */

export interface ConsultingImage {
  id: string;
  name: string;
  url: string;
  /** When the photograph was taken, which is what the dialog groups by. */
  takenAt: string;
}

interface Props {
  images: ConsultingImage[];
  /** Rows of the "Dữ liệu tư vấn" catalogue. */
  catalog: { id: string; name: string }[];
  uploading?: boolean;
  onUpload: (files: File[]) => void;
  onDelete?: (image: ConsultingImage) => void;
}

function dayOf(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()}`;
}

function timeOf(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dayOf(iso)} ${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function PatientConsultingImagePanel({
  images,
  catalog,
  uploading,
  onUpload,
  onDelete,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listOpen, setListOpen] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  // Shown unless explicitly unticked, so a photograph just uploaded appears on
  // the panel straight away rather than waiting to be chosen.
  const shown = useMemo(
    () => images.filter((image) => !hidden.includes(image.id)),
    [images, hidden],
  );

  // A deleted image must not stay on the hidden list, or its id would suppress
  // a later one that happens to reuse it.
  useEffect(() => {
    setHidden((current) => current.filter((id) => images.some((image) => image.id === id)));
  }, [images]);

  const byDay = useMemo(() => {
    const groups = new Map<string, ConsultingImage[]>();
    for (const image of images) {
      const day = dayOf(image.takenAt);
      groups.set(day, [...(groups.get(day) ?? []), image]);
    }
    return [...groups.entries()];
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

  return (
    <div className="pd-image-panel">
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
        {uploading ? (
          <Spin />
        ) : (
          <>
            <FileImageOutlined />
            <span>{t("Kéo ảnh vào hoặc bấm nút để tải lên")}</span>
          </>
        )}
      </div>

      {shown.length > 0 && (
        <div className="pd-image-shown">
          <Image.PreviewGroup>
            {shown.map((image) => (
              <Image key={image.id} src={image.url} alt={image.name} />
            ))}
          </Image.PreviewGroup>
        </div>
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

      <Modal
        open={listOpen}
        title={t("Chọn ảnh hiển thị")}
        width={1024}
        onCancel={() => setListOpen(false)}
        destroyOnHidden
        className="pd-image-picker"
        footer={
          <div className="pd-image-list-foot">
            <Button onClick={() => setHidden([])}>{t("Chọn tất cả")}</Button>
            <Button type="primary" onClick={() => setListOpen(false)}>
              {t("Xong")}
            </Button>
          </div>
        }
      >
        {images.length === 0 ? (
          <div className="pd-image-list-empty">{t("Chưa có ảnh nào.")}</div>
        ) : (
          byDay.map(([day, taken]) => (
            <section key={day} className="pd-image-day">
              <h4>{day}</h4>
              <div className="pd-image-cards">
                {taken.map((image) => {
                  const checked = !hidden.includes(image.id);
                  return (
                    <article
                      key={image.id}
                      className={["pd-image-card", checked && "pd-image-card--on"]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="pd-image-thumb">
                        <Checkbox
                          checked={checked}
                          aria-label={image.name}
                          onChange={(event) => toggle(image.id, event.target.checked)}
                        />
                        <img src={image.url} alt={image.name} />
                      </div>
                      <b>{image.name}</b>
                      <small>{timeOf(image.takenAt)}</small>
                      <div className="pd-image-card-actions">
                        {/* The reference's own pair: a drag handle for ordering
                            and a delete. Ordering is not stored yet — see
                            docs/clone/unknowns.md. */}
                        <Button
                          shape="circle"
                          aria-label={t("Sắp xếp")}
                          icon={<HolderOutlined />}
                        />
                        <Button
                          danger
                          shape="circle"
                          aria-label={t("Xoá ảnh")}
                          icon={<DeleteOutlined />}
                          onClick={() => onDelete?.(image)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </Modal>
    </div>
  );
}
