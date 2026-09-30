import { useMemo, useState } from "react";
import { Button, Modal } from "antd";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import {
  groupImagesByDay,
  type PatientImageDay,
  type PatientImageViewModel,
} from "../../api/patientImageAdapters";
import { ConsultingImageDay } from "./ConsultingImageDay";

interface Props {
  open: boolean;
  images: PatientImageViewModel[];
  /** Ids unticked in the dialog; everything else is on the panel. */
  hidden: string[];
  canSort: boolean;
  onToggle: (id: string, checked: boolean) => void;
  onShowAll: () => void;
  onClose: () => void;
  /** Resolves true once the image is gone; the confirm stays open otherwise. */
  onDelete?: (image: PatientImageViewModel) => Promise<boolean>;
  /** A delete is in flight: the confirm's button spins. */
  deleting?: boolean;
  onReorder: (day: PatientImageDay, from: number, to: number) => void;
}

/**
 * "Chọn ảnh hiển thị" — the reference's dialog behind Danh sách ảnh: the
 * photographs grouped under the day they were taken, one row per day scrolled
 * sideways, each on a 280px card with a tick, its name, its time and the
 * reference's two round actions.
 * Dragging a card by its grip reorders it within its own day, saved with the
 * same call the Hình ảnh tab makes. The bin asks first — "Xác nhận xoá ảnh",
 * the same confirm the Hình ảnh tab and the reference show — and its Xoá
 * spins until the server has answered.
 */
export function ConsultingImagePicker({
  open,
  images,
  hidden,
  canSort,
  onToggle,
  onShowAll,
  onClose,
  onDelete,
  deleting,
  onReorder,
}: Props) {
  const days = useMemo(() => groupImagesByDay(images), [images]);
  const [removing, setRemoving] = useState<PatientImageViewModel | null>(null);

  const handleConfirmDelete = async () => {
    if (!removing || !onDelete) return;
    if (await onDelete(removing)) setRemoving(null);
  };

  return (
    <Modal
      open={open}
      title={t("Patient:Image:SelectImagePickerTitle")}
      width={1024}
      onCancel={onClose}
      destroyOnHidden
      className="pd-image-picker"
      footer={
        <div className="pd-image-list-foot">
          <Button onClick={onShowAll}>{t("Common:SelectAll")}</Button>
          <Button type="primary" onClick={onClose}>
            {t("Patient:Image:Done")}
          </Button>
        </div>
      }
    >
      {images.length === 0 ? (
        <div className="pd-image-list-empty">{t("Common:NoImage")}</div>
      ) : (
        days.map((day) => (
          <ConsultingImageDay
            key={day.key}
            day={day}
            hidden={hidden}
            canSort={canSort}
            onToggle={onToggle}
            onDelete={onDelete ? setRemoving : undefined}
            onReorder={onReorder}
          />
        ))
      )}

      <ConfirmDeleteDialog
        open={removing !== null}
        noun={t("Patient:Image:Noun")}
        title={t("Patient:Image:DeleteTitle")}
        question={t("Patient:Image:DeleteQuestion")}
        pending={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setRemoving(null)}
      />
    </Modal>
  );
}
