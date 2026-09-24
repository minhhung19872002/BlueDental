import { Modal } from "antd";
import { useSearchParams } from "react-router-dom";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboChildForm } from "./LaboChildForm";
import {
  LABO_MODAL_PARAM,
  LABO_ROW_PARAM,
  laboModalLabels,
  type LaboChildKind,
} from "./laboModalKeys";
import "../labo-order-dialog.css";

interface Props {
  /** Which of the two child dialogs is up; null keeps it closed. */
  kind: LaboChildKind | null;
  branchId: string;
  /** The row the plus or the shield was pressed on. */
  parent: LaboOrderDto;
}

/**
 * "Tiếp tục công đoạn" and "Bảo hành" raised from a Mẫu Labo row: one form
 * on the row's order, without the patient tab's pills or its order picker
 * (staging, docs/clone/pages/labo.md §2.6). The URL still names the dialog
 * and the row, as it does on the patient's tab, and both go on close.
 */
export function LaboChildDialog({ kind, branchId, parent }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();

  const close = () => {
    const next = new URLSearchParams(searchParams);
    next.delete(LABO_MODAL_PARAM);
    next.delete(LABO_ROW_PARAM);
    setSearchParams(next, { replace: true });
  };

  return (
    <Modal
      open={kind !== null}
      width={772}
      className="pd-labo-dialog pd-labo-child-dialog"
      title={kind ? laboModalLabels()[kind] : ""}
      onCancel={close}
      footer={null}
      destroyOnHidden
    >
      {kind && (
        <LaboChildForm
          open
          kind={kind}
          branchId={branchId}
          patient={{
            id: parent.patientId,
            code: parent.patientCode ?? "",
            name: parent.patientName ?? "",
          }}
          orders={[parent]}
          parentId={parent.id}
          hideParentPicker
          onSaved={close}
        />
      )}
    </Modal>
  );
}
