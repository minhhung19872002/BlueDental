import { api } from "./axios";

/**
 * Downloads a file the API generates (Excel, PDF).
 *
 * The browser cannot follow a plain link here — every API call carries the auth
 * cookie and an Accept-Language header through axios — so the bytes are fetched
 * and handed to the browser as a blob.
 */
export async function downloadFile(
  url: string,
  fallbackName: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const response = await api.get<Blob>(url, { params, responseType: "blob" });
  saveBlob(response.data, response.headers["content-disposition"], fallbackName);
}

/**
 * Same, for a file the server builds out of an upload — the error report of an
 * Excel import. The upload is the request body, so this has to be a POST.
 */
export async function downloadPostedFile(
  url: string,
  body: FormData,
  fallbackName: string,
): Promise<void> {
  const response = await api.post<Blob>(url, body, { responseType: "blob" });
  saveBlob(response.data, response.headers["content-disposition"], fallbackName);
}

function saveBlob(blob: Blob, dispositionHeader: unknown, fallbackName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileNameFrom(dispositionHeader) ?? fallbackName;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
}

/** The server names the file; the header is what carries that name. */
function fileNameFrom(header: unknown): string | undefined {
  if (typeof header !== "string") return undefined;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) return decodeURIComponent(utf8[1]);

  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1];
}
