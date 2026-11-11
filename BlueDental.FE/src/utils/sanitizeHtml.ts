/**
 * Strips all HTML tags from a string, leaving plain text.
 * Used to sanitize rich-text content before showing in tooltips or table cells.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * A rich-text body as it should be saved: "" when the editor holds nothing a
 * reader would see. An emptied Quill still writes `<p><br></p>`, which would
 * otherwise be stored as if the author had typed something.
 */
export function richTextForSave(html: string | null | undefined): string {
  if (!html) return "";
  const hasMedia = /<(img|iframe|video)\b/i.test(html);
  const hasText = stripHtml(html).replace(/&nbsp;/g, " ").trim().length > 0;
  return hasMedia || hasText ? html : "";
}

const HTML_TAG = /<\/?[a-z][^>]*>/i;

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A body as the rich-text editor should be handed it. Markup goes through as
 * is; plain text written before the field became rich text (Yêu cầu on a Labo
 * slip, R-1212) turns each line into a paragraph, or Quill would read it as
 * one run and lose the line breaks.
 */
export function asRichText(text: string | null | undefined): string {
  if (!text) return "";
  if (HTML_TAG.test(text)) return text;
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}

/**
 * Truncates text to a maximum length, adding an ellipsis if truncated.
 */
export function truncate(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "…";
}
