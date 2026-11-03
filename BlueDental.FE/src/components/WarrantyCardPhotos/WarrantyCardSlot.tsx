import { useRef } from "react";
import { CloseOutlined } from "@ant-design/icons";
import { ImagePlus } from "lucide-react";
import { t } from "@/lib/i18n";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";

interface Props {
  /** "Mặt trước" / "Mặt sau", already translated. */
  label: string;
  /** The photo of this face, absent while there is none. */
  url?: string;
  disabled?: boolean;
  onView: () => void;
  /** Left out, the slot only shows its photo. */
  onPick?: (file: File) => void;
  onRemove?: () => void;
}

/**
 * One face of the card: its photo with "Xóa ảnh" in the corner, or a dashed
 * card-shaped well that reads the face's name and opens the file picker.
 */
export function WarrantyCardSlot({ label, url, disabled, onView, onPick, onRemove }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  if (url) {
    return (
      <div className="bd-warranty-photo">
        <button type="button" className="bd-warranty-photo-view" aria-label={t("Common:WarrantyCard:View", label)} onClick={onView}>
          <img src={url} alt={label} />
        </button>
        <span className="bd-warranty-photo-side">{label}</span>
        {onRemove && (
          <button
            type="button"
            className="bd-warranty-photo-remove"
            aria-label={t("Common:WarrantyCard:Remove", label)}
            disabled={disabled}
            onClick={onRemove}
          >
            <CloseOutlined />
          </button>
        )}
      </div>
    );
  }

  if (!onPick) return null;

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file);
          // Cleared so picking the same file again still fires a change.
          event.target.value = "";
        }}
      />
      <button
        type="button"
        className="bd-warranty-photo-well"
        aria-label={t("Common:WarrantyCard:Upload", label)}
        disabled={disabled}
        onClick={() => fileInput.current?.click()}
      >
        <ImagePlus size={20} aria-hidden />
        <span>{label}</span>
      </button>
    </>
  );
}
