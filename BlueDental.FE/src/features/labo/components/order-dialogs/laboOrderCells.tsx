import { useState, type ReactNode } from "react";
import { Button, Image, Tooltip } from "antd";
import {
  DeleteOutlined,
  EyeOutlined,
  FileSearchOutlined,
  FolderFilled,
  SafetyOutlined,
} from "@ant-design/icons";
import { LabelBadge } from "@/components/LabelColor";
import { t } from "@/lib/i18n";
import {
  LABO_STATUS,
  type LaboOrderDto,
  type LaboOrderImageDto,
  type LaboStatus,
} from "@/features/labo/api/laboApi";

interface SupplierBadgeProps {
  name: string | undefined;
  color: string | null | undefined;
}

/**
 * The lab's name in the badge colour its Nhà cung cấp record chose, grey when
 * none was or the order only carries a typed name (R-1072).
 */
export function LaboSupplierBadge({ name, color }: SupplierBadgeProps) {
  if (!name) return <span>—</span>;
  return <LabelBadge color={color} title={name}>{name}</LabelBadge>;
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

/** The row buttons beside the eye, as the BA gives them per status (P2910_03 §2D). */
type LaboRowAction = "check" | "warranty" | "delete";

const STATUS_ACTIONS: Record<LaboStatus, readonly LaboRowAction[]> = {
  [LABO_STATUS.Draft]: ["delete"],
  [LABO_STATUS.Sent]: ["check"],
  [LABO_STATUS.AwaitingCheck]: ["check"],
  [LABO_STATUS.Returned]: ["check"],
  [LABO_STATUS.Completed]: ["warranty"],
  [LABO_STATUS.Warranty]: [],
  [LABO_STATUS.Cancelled]: [],
};

const ACTION_LOOK: Record<LaboRowAction, { label: string; tone: string; icon: ReactNode }> = {
  check: { label: "Labo:Workflow:CheckAction", tone: "primary", icon: <FileSearchOutlined /> },
  warranty: { label: "Labo:Workflow:WarrantyAction", tone: "success", icon: <SafetyOutlined /> },
  delete: { label: "Common:Delete", tone: "danger", icon: <DeleteOutlined /> },
};

export interface LaboRowActionHandlers {
  onDetail: (order: LaboOrderDto) => void;
  /** Each absent where the user may not do it; Mẫu Labo passes none of them. */
  onCheck?: (order: LaboOrderDto) => void;
  onWarranty?: (order: LaboOrderDto) => void;
  onDelete?: (order: LaboOrderDto) => void;
}

interface RowActionsProps extends LaboRowActionHandlers {
  row: LaboOrderDto;
  /** The eye's name; "Xem chi tiết" (the patient tab's) unless told otherwise. */
  detailLabel?: string;
}

/**
 * Thao tác on a labo row: the eye always opens the order; beside it the one
 * step its status waits on — delete a Nháp, check what the Labo delivered,
 * activate the warranty of a Hoàn thành order. Nothing more once it is under
 * warranty or cancelled.
 */
export function LaboRowActions({ row, detailLabel, onDetail, ...handlers }: RowActionsProps) {
  const viewLabel = detailLabel ?? t("Patient:Profile:ViewDetail");
  const handlerOf: Record<LaboRowAction, ((order: LaboOrderDto) => void) | undefined> = {
    check: handlers.onCheck,
    warranty: handlers.onWarranty,
    delete: handlers.onDelete,
  };
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
      {STATUS_ACTIONS[row.status].map((action) => {
        const handle = handlerOf[action];
        if (!handle) return null;
        const look = ACTION_LOOK[action];
        return (
          <Tooltip key={action} title={t(look.label)}>
            <Button
              type="text"
              className={`pd-labo-act pd-labo-act--${look.tone}`}
              icon={look.icon}
              aria-label={t(look.label)}
              onClick={() => handle(row)}
            />
          </Tooltip>
        );
      })}
    </span>
  );
}
