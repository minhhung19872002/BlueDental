import type { RefObject } from "react";
import { Button, Modal, type InputRef } from "antd";
import { useDraggableModal } from "@/hooks/useDraggableModal";
import { useT } from "@/lib/i18n";
import { StaffNotesPanel } from "./StaffNotesPanel";

interface Props {
  open: boolean;
  searchRef: RefObject<InputRef | null>;
  onClose: () => void;
}

const WIDTH = 680;

/**
 * "Thêm ghi chú" — a dialog that sits beside the work instead of over it: no
 * dimmed backdrop, the screen behind stays clickable and typable (so a note can
 * be copied straight into a form), and the title row drags it out of the way.
 * Only X and "Hủy" close it; a stray click outside or an Escape meant for
 * something else on the screen does not.
 */
export function StaffNotesDialog({ open, searchRef, onClose }: Props) {
  const t = useT();
  const { dragStyle, handleProps, reset } = useDraggableModal();

  return (
    <Modal
      open={open}
      width={WIDTH}
      title={
        <div className="bd-modal-head staff-notes-handle" {...handleProps}>
          <h2 className="bd-modal-title">{t("StaffNote:Title")}</h2>
        </div>
      }
      onCancel={onClose}
      afterOpenChange={(visible) => {
        if (visible) searchRef.current?.focus();
        else reset();
      }}
      mask={{ enabled: false, closable: false }}
      keyboard={false}
      focusable={{ trap: false }}
      scrollLock={false}
      destroyOnHidden
      className="app-dialog staff-notes-dialog"
      classNames={{ wrapper: "staff-notes-wrap" }}
      modalRender={(node) => (
        <div className="staff-notes-drag" style={dragStyle}>
          {node}
        </div>
      )}
      footer={
        <div className="bd-modal-foot">
          <div className="bd-min0" />
          <div className="bd-modal-foot-actions">
            <Button onClick={onClose}>{t("Common:Cancel")}</Button>
          </div>
        </div>
      }
    >
      <StaffNotesPanel searchRef={searchRef} />
    </Modal>
  );
}
