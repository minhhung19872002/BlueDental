import type { CSSProperties } from "react";
import { Button, Checkbox } from "antd";
import { DeleteOutlined, HolderOutlined } from "@ant-design/icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../api/patientImageAdapters";

interface Props {
  image: PatientImageViewModel;
  checked: boolean;
  canSort: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onDelete?: (image: PatientImageViewModel) => void;
}

/**
 * One 280px card in "Chọn ảnh hiển thị": the tick over the picture, its name
 * and time, and the reference's two round actions. The grip is the only drag
 * handle, so ticking or deleting never starts a drag.
 */
export function ConsultingImageCard({ image, checked, canSort, onToggle, onDelete }: Props) {
  const sortable = useSortable({ id: image.id, disabled: !canSort });
  const style = {
    "--pd-drag-transform": CSS.Translate.toString(sortable.transform) ?? "none",
    "--pd-drag-transition": sortable.transition ?? "none",
  } as CSSProperties;
  const className = [
    "pd-image-card",
    checked && "pd-image-card--on",
    sortable.isDragging && "pd-image-card--dragging",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article ref={sortable.setNodeRef} className={className} style={style} data-image-id={image.id}>
      <div className="pd-image-thumb">
        <Checkbox
          checked={checked}
          aria-label={image.fileName}
          onChange={(event) => onToggle(image.id, event.target.checked)}
        />
        <img src={image.url} alt={image.fileName} draggable={false} />
      </div>
      <b>{image.fileName}</b>
      <small>{image.takenLabel}</small>
      <div className="pd-image-card-actions">
        {canSort && (
          <Button
            ref={sortable.setActivatorNodeRef}
            shape="circle"
            aria-label={t("Sắp xếp")}
            icon={<HolderOutlined />}
            {...sortable.attributes}
            {...sortable.listeners}
          />
        )}
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
}
