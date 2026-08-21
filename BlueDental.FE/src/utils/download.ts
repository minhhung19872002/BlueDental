/**
 * Triggers a browser download for the given Blob.
 * @param blob - The Blob or File to download
 * @param filename - The suggested filename
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Downloads a file from a URL by triggering a fetch and saveAs.
 */
export async function downloadUrl(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
  downloadBlob(blob, filename);
}
