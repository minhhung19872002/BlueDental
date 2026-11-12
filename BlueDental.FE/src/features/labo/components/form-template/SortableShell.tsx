import type { CSSProperties, ReactNode } from "react";
import { HolderOutlined } from "@ant-design/icons";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { LayoutDragData } from "./layoutDnd";
import { useTakesDrag } from "./useLayoutDnd";

interface Props {
  id: string;
  data: LayoutDragData;
  /** The handle's accessible name: "Kéo khối …" / "Kéo trường …". */
  handleLabel: string;
  variant: "block" | "field";
  children: ReactNode;
}

/**
 * A row of the Mẫu phiếu builder that can be dragged (R-1202) by the grip on
 * its left — the inputs inside keep their clicks and typing. Space or Enter on
 * the focused grip picks it up for the arrow keys.
 */
export function SortableShell({ id, data, handleLabel, variant, children }: Props) {
  const takesDrag = useTakesDrag(data.type);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, data, disabled: { draggable: false, droppable: !takesDrag } });
  const style = {
    "--ft-drag-transform": CSS.Translate.toString(transform) ?? "none",
    "--ft-drag-transition": transition ?? "none",
  } as CSSProperties;
  const className = ["ft-sortable", `ft-sortable--${variant}`, isDragging && "is-dragging"].filter(Boolean).join(" ");

  return (
    <div ref={setNodeRef} className={className} style={style} data-row-id={id}>
      <button
        type="button"
        ref={setActivatorNodeRef}
        className="ft-grip"
        {...attributes}
        {...listeners}
        aria-label={handleLabel}
        title={handleLabel}
      >
        <HolderOutlined />
      </button>
      <div className="ft-sortable-body">{children}</div>
    </div>
  );
}
