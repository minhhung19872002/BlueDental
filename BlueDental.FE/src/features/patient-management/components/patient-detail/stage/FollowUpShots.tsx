import { useRef } from "react";
import { Button } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { StageShots } from "./StageShots";

interface Props {
  files: File[];
  /** Blob URLs for `files`, same order — owned by the caller. */
  previews: string[];
  onAdd: (files: File[]) => void;
  onRemove: (at: number) => void;
}

/**
 * Hình ảnh on the follow-up form: a count line, the chosen pictures as
 * thumbnails, then Tải Ảnh.
 */
export function FollowUpShots({ files, previews, onAdd, onRemove }: Props) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        multiple
        hidden
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          // Clear it, or picking the same file twice fires no change event.
          if (input.current) input.current.value = "";
        }}
      />

      <div className="pd-stage-images">
        <p>{t("Hình ảnh")}:</p>
        <p>{files.length === 0 ? t("(Trống)") : t("{0} ảnh", files.length)}</p>
      </div>

      <StageShots files={files} previews={previews} onRemove={onRemove} />

      <Button block icon={<PictureOutlined />} onClick={() => input.current?.click()}>
        {t("Tải Ảnh")}
      </Button>
    </>
  );
}
