import type { ChangeEvent, RefObject } from "react";
import { IMAGE_ACCEPT } from "@/utils/validateImageFile";

interface Props {
  inputRef: RefObject<HTMLInputElement | null>;
  onFiles: (files: File[]) => void;
  testId?: string;
}

/**
 * The hidden OS file chooser behind "Tải ảnh" and "+ Chọn thêm ảnh": several
 * pictures at a time, and cleared after each pick so the same file can be
 * picked again.
 */
export function ImageFileInput({ inputRef, onFiles, testId = "patient-image-input" }: Props) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) onFiles(files);
  };

  return (
    <input
      ref={inputRef}
      type="file"
      accept={IMAGE_ACCEPT}
      multiple
      hidden
      data-testid={testId}
      onChange={handleChange}
    />
  );
}
