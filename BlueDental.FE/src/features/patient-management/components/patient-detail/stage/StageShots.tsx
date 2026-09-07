import { CloseOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  files: File[];
  /** Blob URLs for `files`, same order — owned by the caller. */
  previews: string[];
  onRemove: (at: number) => void;
}

/**
 * The pictures chosen before a công đoạn or tái khám exists, as thumbnails each
 * with its own remove.
 *
 * Shared by both forms that pick images ahead of saving: the reference lists
 * them rather than only counting them, which is what lets you notice the wrong
 * file before it is uploaded.
 */
export function StageShots({ files, previews, onRemove }: Props) {
  if (files.length === 0) return null;

  return (
    <div className="pd-stage-shots">
      {files.map((file, index) => (
        <div key={`${file.name}-${file.lastModified}-${index}`}>
          <img src={previews[index]} alt={file.name} />
          <button
            type="button"
            aria-label={t("Bỏ ảnh {0}", file.name)}
            onClick={() => onRemove(index)}
          >
            <CloseOutlined />
          </button>
        </div>
      ))}
    </div>
  );
}
