import { t } from "@/lib/i18n";

/** MIME types accepted for image uploads across the application. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

const MEGABYTE = 1024 * 1024;

/** Maximum file size for image uploads (5 MB). */
export const MAX_IMAGE_BYTES = 5 * MEGABYTE;

/** `accept` attribute value for `<input type="file">` pickers. */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

/**
 * Validates a file is an accepted image type and under the size limit — 5 MB
 * unless the caller allows more. Returns `null` when valid, or a user-facing
 * error string.
 */
export function validateImageFile(file: File, maxBytes: number = MAX_IMAGE_BYTES): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    return t("Common:Validation:ImageTypesOnly");
  }
  if (file.size > maxBytes) {
    return t("Common:Validation:ImageMaxSize", maxBytes / MEGABYTE);
  }
  return null;
}

/**
 * Filters an array of files, keeping only valid images.
 * Shows a toast for the first rejected file.
 */
export function filterValidImageFiles(
  files: File[],
  onError: (message: string) => void,
): File[] {
  const valid: File[] = [];
  for (const file of files) {
    const error = validateImageFile(file);
    if (error) {
      onError(`${file.name}: ${error}`);
    } else {
      valid.push(file);
    }
  }
  return valid;
}
