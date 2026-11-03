import { memo, type CSSProperties } from "react";
import { Tooltip } from "antd";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
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
 * One photograph in a stage column: a square tile that opens the viewer, its
 * running number in the corner, and the grip / trash laid over it (on hover,
 * or always on a touch screen). The grip is the only drag handle, so tapping
 * the picture never starts a drag.
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
        aria-label={t("Patient:Image:ViewFileLabel", image.fileName)}
        title={[image.takenLabel, image.note].filter(Boolean).join(" · ")}
        onClick={() => onView(image)}
      >
        <img src={image.url} alt={image.fileName} loading="lazy" draggable={false} />
      </button>
      <span className="pi-card-no" aria-hidden="true" />

      <div className="pi-card-actions">
        {canSort && (
          <Tooltip title={t("Patient:Photo:Sort")}>
            <button
              type="button"
              ref={sortable.setActivatorNodeRef}
              className="pi-tile-btn pi-tile-btn--grip"
              aria-label={t("Patient:Photo:Sort")}
              {...sortable.attributes}
              {...sortable.listeners}
            >
              <GripVertical size={13} />
            </button>
          </Tooltip>
        )}
        {canDelete && image.deletable && (
          <Tooltip title={t("Patient:Image:DeleteLabel")}>
            <button
              type="button"
              className="pi-tile-btn pi-tile-btn--delete"
              aria-label={t("Patient:Image:DeleteLabel")}
              onClick={() => onDelete(image)}
            >
              <Trash2 size={12} />
            </button>
          </Tooltip>
        )}
      </div>
    </article>
  );
});
