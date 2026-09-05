import { memo, type CSSProperties } from "react";
import { Tooltip } from "antd";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, GripVertical, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";

interface Props {
  image: PatientImageViewModel;
  canSort: boolean;
  canDelete: boolean;
  onView: (image: PatientImageViewModel) => void;
  onDelete: (image: PatientImageViewModel) => void;
}

/**
 * One photograph on the timeline: the picture (a button that opens the
 * viewer), its file name and time, and the grip / eye / trash row. The grip is
 * the only drag handle, so clicking the picture never starts a drag.
 */
export const PatientImageCard = memo(function PatientImageCard({
  image,
  canSort,
  canDelete,
  onView,
  onDelete,
}: Props) {
  const sortable = useSortable({ id: image.id, disabled: !canSort });
  const style = {
    "--pi-drag-transform": CSS.Translate.toString(sortable.transform) ?? "none",
    "--pi-drag-transition": sortable.transition ?? "none",
  } as CSSProperties;

  return (
    <article
      ref={sortable.setNodeRef}
      className={["pi-card", sortable.isDragging && "pi-card--dragging"].filter(Boolean).join(" ")}
      style={style}
      data-testid="patient-image-card"
      data-image-id={image.id}
    >
      <button
        type="button"
        className="pi-card-picture"
        aria-label={t("Xem ảnh {0}", image.fileName)}
        onClick={() => onView(image)}
      >
        <img src={image.url} alt={image.fileName} loading="lazy" draggable={false} />
      </button>
      <p className="pi-card-name">{image.fileName}</p>
      <p className="pi-card-time">{image.takenLabel}</p>

      <div className="pi-card-actions">
        {canSort && (
          <Tooltip title={t("Sắp xếp ảnh")}>
            <button
              type="button"
              ref={sortable.setActivatorNodeRef}
              className="pi-round pi-round--grip"
              aria-label={t("Sắp xếp ảnh")}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <GripVertical size={16} />
            </button>
          </Tooltip>
        )}
        <Tooltip title={t("Xem ảnh")}>
          <button
            type="button"
            className="pi-round pi-round--view"
            aria-label={t("Xem ảnh")}
            onClick={() => onView(image)}
          >
            <Eye size={16} />
          </button>
        </Tooltip>
        {canDelete && (
          <Tooltip title={t("Xóa ảnh")}>
            <button
              type="button"
              className="pi-round pi-round--delete"
              aria-label={t("Xóa ảnh")}
              onClick={() => onDelete(image)}
            >
              <Trash2 size={16} />
            </button>
          </Tooltip>
        )}
      </div>
    </article>
  );
});
