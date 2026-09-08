import { useMemo } from "react";
import { Button, Modal } from "antd";
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
  onDelete?: (image: PatientImageViewModel) => void;
  onReorder: (day: PatientImageDay, from: number, to: number) => void;
}

/**
 * "Chọn ảnh hiển thị" — the reference's dialog behind Danh sách ảnh: the
 * photographs grouped under the day they were taken, one row per day scrolled
 * sideways, each on a 280px card with a tick, its name, its time and the
 * reference's two round actions.
 * Dragging a card by its grip reorders it within its own day, saved with the
 * same call the Hình ảnh tab makes.
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
  onReorder,
}: Props) {
  const days = useMemo(() => groupImagesByDay(images), [images]);

  return (
    <Modal
      open={open}
      title={t("Chọn ảnh hiển thị")}
      width={1024}
      onCancel={onClose}
      destroyOnHidden
      className="pd-image-picker"
      footer={
        <div className="pd-image-list-foot">
          <Button onClick={onShowAll}>{t("Chọn tất cả")}</Button>
          <Button type="primary" onClick={onClose}>
            {t("Xong")}
          </Button>
        </div>
      }
    >
      {images.length === 0 ? (
        <div className="pd-image-list-empty">{t("Chưa có ảnh nào.")}</div>
      ) : (
        days.map((day) => (
          <ConsultingImageDay
            key={day.key}
            day={day}
            hidden={hidden}
            canSort={canSort}
            onToggle={onToggle}
            onDelete={onDelete}
            onReorder={onReorder}
          />
        ))
      )}
    </Modal>
  );
}
