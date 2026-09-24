import { useState } from "react";
import { Button, Image, Tooltip } from "antd";
import { EyeOutlined, FolderFilled, PlusOutlined, SafetyOutlined } from "@ant-design/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { t } from "@/lib/i18n";
import { formatDateTime } from "@/utils/format";
import {
  canContinueLaboOrder,
  type LaboOrderDto,
  type LaboOrderImageDto,
} from "@/features/labo/api/laboApi";

interface DatePillProps {
  date: string | undefined;
  pill: { label: string; bg: string; color: string };
}

/**
 * A `DD/MM/YYYY HH:mm` line with the pill under it — Ngày gửi / Tình trạng
 * mẫu and Ngày giao / Trạng thái Labo, stacked the way the reference stacks
 * them on both the patient's Labo tab and Mẫu Labo.
 */
export function LaboDatePill({ date, pill }: DatePillProps) {
  const text = formatDateTime(date);
  return (
    <div className="pd-labo-cell">
      <span>{date ? text : "—"}</span>
      <StatusBadge label={t(pill.label)} bg={pill.bg} color={pill.color} />
    </div>
  );
}

interface ImagesButtonProps {
  images: LaboOrderImageDto[];
  /** The tooltip and accessible name while there are pictures to open. */
  label: string;
}

/**
 * The reference's yellow folder under "File phòng khám gửi về": it opens the
 * order's pictures in a lightbox, and is greyed while the order has none.
 */
export function LaboImagesButton({ images, label }: ImagesButtonProps) {
  const [open, setOpen] = useState(false);
  const hasImages = images.length > 0;
  return (
    <>
      <Tooltip title={hasImages ? label : t("Patient:Misc:NoFile")}>
        <Button
          type="text"
          className="pd-labo-file"
          icon={<FolderFilled />}
          disabled={!hasImages}
          aria-label={label}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      {hasImages && (
        <Image.PreviewGroup
          items={images.map((image) => ({ src: image.url, alt: image.fileName }))}
          preview={{ open, onOpenChange: setOpen }}
        />
      )}
    </>
  );
}

export interface LaboRowActionHandlers {
  onDetail: (order: LaboOrderDto) => void;
  /**
   * Both absent when the user may not raise child orders (treatmentLabo:create).
   * The plus additionally hides itself on a row whose treatment line is done.
   */
  onContinue?: (order: LaboOrderDto) => void;
  onWarranty?: (order: LaboOrderDto) => void;
}

interface RowActionsProps extends LaboRowActionHandlers {
  row: LaboOrderDto;
  /** The eye's name; "Xem chi tiết" (the patient tab's) unless told otherwise. */
  detailLabel?: string;
}

/**
 * Thao tác on a labo row: the eye opens the read-only detail, the plus raises
 * "Tiếp tục công đoạn" and the shield "Bảo hành" on the row — the same icon
 * buttons the other patient tables use, in the same three colours.
 *
 * The reference (staging, both Mẫu Labo and the patient's Labo tab) always
 * draws the eye; with the create permission it draws the shield always and
 * the plus unless the order's treatment line is done. The order's own status
 * and kind never matter — a cancelled order keeps all three.
 */
export function LaboRowActions({
  row,
  detailLabel,
  onDetail,
  onContinue,
  onWarranty,
}: RowActionsProps) {
  const viewLabel = detailLabel ?? t("Patient:Profile:ViewDetail");
  return (
    <span className="pd-icon-actions">
      <Tooltip title={viewLabel}>
        <Button
          type="text"
          className="pd-labo-act pd-labo-act--info"
          icon={<EyeOutlined />}
          aria-label={viewLabel}
          onClick={() => onDetail(row)}
        />
      </Tooltip>
      {onContinue && canContinueLaboOrder(row) && (
        <Tooltip title={t("Patient:Stage:Continue")}>
          <Button
            type="text"
            className="pd-labo-act pd-labo-act--primary"
            icon={<PlusOutlined />}
            aria-label={t("Patient:Stage:Continue")}
            onClick={() => onContinue(row)}
          />
        </Tooltip>
      )}
      {onWarranty && (
        <Tooltip title={t("Patient:Labo:Warranty")}>
          <Button
            type="text"
            className="pd-labo-act pd-labo-act--success"
            icon={<SafetyOutlined />}
            aria-label={t("Patient:Labo:Warranty")}
            onClick={() => onWarranty(row)}
          />
        </Tooltip>
      )}
    </span>
  );
}
