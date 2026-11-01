import { useRef } from "react";
import { Button } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";
import { LABO_MAX_PICTURES } from "../order-dialogs/useLaboPictureTiles";

interface Props {
  tooth: number;
  count: number;
  busy: boolean;
  onAdd: (files: File[]) => void;
}

/** «Tải ảnh» on the right of a Đạt tooth (P0111_02, R-1110): five pictures at most, then it rests. */
export function LaboToothPictureButton({ tooth, count, busy, onAdd }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []));
          // Cleared so choosing the same file twice still fires a change.
          if (fileInput.current) fileInput.current.value = "";
        }}
      />
      <Button
        className="pd-labo-tooth-upload"
        icon={<PictureOutlined />}
        disabled={busy || count >= LABO_MAX_PICTURES}
        aria-label={t("Labo:Check:PassedPicturesAdd", tooth)}
        onClick={() => fileInput.current?.click()}
      >
        {count > 0 ? t("Labo:Check:PassedPicturesCount", count, LABO_MAX_PICTURES) : t("Patient:Photo:Upload")}
      </Button>
    </>
  );
}
