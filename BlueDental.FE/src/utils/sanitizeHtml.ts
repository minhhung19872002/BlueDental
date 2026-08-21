/**
 * Strips all HTML tags from a string, leaving plain text.
 * Used to sanitize rich-text content before showing in tooltips or table cells.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Truncates text to a maximum length, adding an ellipsis if truncated.
 */
export function truncate(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "…";
}
