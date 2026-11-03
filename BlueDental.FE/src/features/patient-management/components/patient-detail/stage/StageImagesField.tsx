import { useEffect, useMemo } from "react";
import { Button } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { StageShots } from "./StageShots";
import type { StageDraft } from "./stageDraft";

interface Props {
  draft: StageDraft;
  onChange: (patch: Partial<StageDraft>) => void;
  onPickImages: () => void;
}

/**
 * Blob previews for the chosen files, revoked when the list changes or the form
 * goes — minting them in the render would hand out a fresh URL on every
 * keystroke and never release one.
 */
function usePreviews(files: File[]): string[] {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);
  return previews;
}

/** Hình ảnh of a công đoạn form: the pictures held until it saves, and "Tải ảnh". */
export function StageImagesField({ draft, onChange, onPickImages }: Props) {
  const previews = usePreviews(draft.pending);

  return (
    <>
      <div className="pd-stage-images">
        <p>{t("Patient:Tab:Images")}:</p>
        <p>
          {draft.pending.length === 0
            ? t("Patient:QuoteSheet:Empty")
            : t("Patient:Stage:PhotosSelected", draft.pending.length)}
        </p>
      </div>
      <StageShots
        files={draft.pending}
        previews={previews}
        onRemove={(at) => onChange({ pending: draft.pending.filter((_, index) => index !== at) })}
      />
      <Button block icon={<PictureOutlined />} onClick={onPickImages}>
        {t("Patient:Photo:UploadButton")}
      </Button>
    </>
  );
}
