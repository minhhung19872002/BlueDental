import { useState } from "react";
import { Image } from "antd";
import { t } from "@/lib/i18n";
import { WarrantyCardSlot } from "./WarrantyCardSlot";
import {
  WARRANTY_CARD_SIDE_LABEL,
  WARRANTY_CARD_SIDES,
  type WarrantyCardSide,
  type WarrantyCardUrls,
} from "./warrantyCardSide";
import "./warranty-card-photos.css";

interface Props {
  /** The photo of each face: a saved photo's URL or a picked file's preview. */
  urls: WarrantyCardUrls;
  /** Left out, the faces only show their photos and an empty face is not drawn. */
  onPick?: (side: WarrantyCardSide, file: File) => void;
  onRemove?: (side: WarrantyCardSide) => void;
  disabled?: boolean;
  /** Table-cell size: small thumbnails in a row. */
  compact?: boolean;
}

/**
 * Ảnh thẻ bảo hành (P3110 REQ-E1): the card's Mặt trước and Mặt sau, each in
 * an ID-card-shaped slot. Optional — either face may be left empty. A photo
 * opens the lightbox on both faces.
 */
export function WarrantyCardPhotos({ urls, onPick, onRemove, disabled, compact }: Props) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = WARRANTY_CARD_SIDES.flatMap((side) => {
    const url = urls[side];
    return url ? [{ side, url, label: t(WARRANTY_CARD_SIDE_LABEL[side]) }] : [];
  });

  return (
    <div className={compact ? "bd-warranty-photos bd-warranty-photos--compact" : "bd-warranty-photos"}>
      {WARRANTY_CARD_SIDES.map((side) => (
        <WarrantyCardSlot
          key={side}
          label={t(WARRANTY_CARD_SIDE_LABEL[side])}
          url={urls[side]}
          disabled={disabled}
          onView={() => setPreview(shown.findIndex((photo) => photo.side === side))}
          onPick={onPick && ((file) => onPick(side, file))}
          onRemove={onRemove && (() => onRemove(side))}
        />
      ))}
      <Image.PreviewGroup
        items={shown.map((photo) => ({ src: photo.url, alt: photo.label }))}
        preview={{
          open: preview !== null,
          current: preview ?? 0,
          onOpenChange: (open) => {
            if (!open) setPreview(null);
          },
          onChange: (current) => setPreview(current),
        }}
      />
    </div>
  );
}
