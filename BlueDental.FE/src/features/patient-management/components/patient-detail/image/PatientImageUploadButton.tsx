import { useRef } from "react";
import { Upload } from "lucide-react";
import { t } from "@/lib/i18n";
import type { UploadProgress } from "../../../hooks/usePatientImageUpload";
import { ImageFileInput } from "./ImageFileInput";

interface Props {
  /** How far an upload has got; `null` while nothing is being sent. */
  progress: UploadProgress | null;
  /** The pictures just chosen, for the upload preview. */
  onPick: (files: File[]) => void;
}

/**
 * "Tải ảnh" on a stage header: the OS file chooser, whose pick opens the
 * upload preview; while a batch is sent it counts what is on its way up.
 */
export function PatientImageUploadButton({ progress, onPick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className="pi-stage-upload"
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={15} />
        <span>
          {progress
            ? t("Patient:Photo:UploadProgress", progress.sending, progress.total)
            : t("Patient:Photo:Upload")}
        </span>
      </button>
      <ImageFileInput inputRef={inputRef} onFiles={onPick} />
    </>
  );
}
