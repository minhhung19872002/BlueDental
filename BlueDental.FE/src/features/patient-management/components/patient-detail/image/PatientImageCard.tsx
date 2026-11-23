import { memo, useCallback, type CSSProperties, type MouseEvent } from "react";
import { Tooltip } from "antd";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import { useLongPress } from "../../../hooks/useLongPress";
import { PatientImageCardTick } from "./PatientImageCardTick";
import { useColumnSelection } from "./columnSelection";

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
 *
 * While its column is being selected in (R-1277) a click on the picture ticks
 * it instead, and the grip and trash step aside; a long press with a finger
 * starts that selection on a touch screen.
 */
export const PatientImageCard = memo(function PatientImageCard({
  image,
  canSort,
  canDelete,
  onView,
  onDelete,
}: Props) {
  const selection = useColumnSelection();
  const selecting = selection.active;
  const picked = selection.isPicked(image.id);
  const tickable = selection.enabled && image.deletable;
  const sortable = useSortable({ id: image.id, disabled: !canSort || selecting });
  const { toggle } = selection;

  const handleToggle = useCallback((extend: boolean) => toggle(image, extend), [toggle, image]);
  const handleLongPress = useCallback(() => {
    if (tickable) toggle(image, false);
  }, [tickable, toggle, image]);
  const longPress = useLongPress(handleLongPress);

  const handlePictureClick = (event: MouseEvent) => {
    if (longPress.consumeClick()) return;
    if (selecting) handleToggle(event.shiftKey);
    else onView(image);
  };

  const style = {
    "--pi-drag-transform": CSS.Translate.toString(sortable.transform) ?? "none",
    "--pi-drag-transition": sortable.transition ?? "none",
  } as CSSProperties;
  const className = [
    "pi-card",
    sortable.isDragging && "pi-card--dragging",
    tickable && "pi-card--tickable",
    selecting && "pi-card--selecting",
    selecting && !image.deletable && "pi-card--locked",
    picked && "pi-card--picked",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      ref={sortable.setNodeRef}
      className={className}
      style={style}
      data-testid="patient-image-card"
      data-image-id={image.id}
    >
      <button
        type="button"
        className="pi-card-picture"
        aria-label={t(selecting ? "Patient:Image:SelectFile" : "Patient:Image:ViewFileLabel", image.fileName)}
        aria-pressed={selecting ? picked : undefined}
        aria-disabled={selecting && !image.deletable ? true : undefined}
        title={[image.takenLabel, image.note].filter(Boolean).join(" · ")}
        onClick={handlePictureClick}
        {...longPress.handlers}
      >
        <img src={image.url} alt={image.fileName} loading="lazy" draggable={false} />
      </button>
      <span className="pi-card-no" aria-hidden="true" />
      {image.xraySource !== null && (
        <span className="pi-card-xray" title={image.xraySource || undefined}>
          {t("Patient:Image:XrayChip")}
        </span>
      )}
      {selection.enabled && (
        <PatientImageCardTick image={image} active={selecting} picked={picked} onToggle={handleToggle} />
      )}

      {!selecting && (
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
      )}
    </article>
  );
});
