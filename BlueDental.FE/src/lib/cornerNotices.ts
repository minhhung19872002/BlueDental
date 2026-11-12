import type { CSSProperties } from "react";

/**
 * The one column of notices top right under the header (R-1217): new chat
 * messages (R-1165) and bookings that just turned Trễ hẹn share it, so neither
 * covers the other. Each stack portals its own region in here; the regions
 * are `display: contents`, which lets every card be an item of this column and
 * sort by {@link nextNoticeOrder} — the newest on top, older ones pushed down,
 * whatever their kind.
 *
 * Rendered into <body>, not the header: the header's backdrop-filter would
 * become the containing block of a fixed box and trap it inside the bar.
 */
const HOST_CLASS = "corner-notices";

let host: HTMLElement | null = null;
let arrivals = 0;

export function cornerNoticeHost(): HTMLElement {
  if (!host || !host.isConnected) {
    host = document.createElement("div");
    host.className = HOST_CLASS;
    document.body.appendChild(host);
  }
  return host;
}

/** Smaller for every notice that comes later, so the newest sorts first. */
export function nextNoticeOrder(): number {
  arrivals += 1;
  return -arrivals;
}

/** The flex `order` of one card, read by `.corner-notices > * > *`. */
export function noticeOrderStyle(order: number): CSSProperties {
  return { "--notice-order": order } as CSSProperties;
}
