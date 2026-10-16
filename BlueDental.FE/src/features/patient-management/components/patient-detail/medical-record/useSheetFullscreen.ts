import { useCallback, useEffect, useState } from "react";

/**
 * "Toàn màn hình" on the bar under the sheet (clinic, 2026-10-16): the canvas
 * covers the window and the browser goes full screen, as F11 would, so the
 * doctor has the whole screen to fill the sheet in.
 *
 * The whole document goes full screen rather than the canvas alone: the
 * pickers, popovers and dialogs the sheet opens render into the page body,
 * and an element in full screen would hide them.
 */
export function useSheetFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);

  // Esc leaves the browser's full screen; the canvas follows it out.
  useEffect(() => {
    if (!fullscreen) return;
    const follow = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, [fullscreen]);

  // Leaving the record while full screen hands the screen back.
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen();
    },
    [],
  );

  const toggle = useCallback(() => {
    if (fullscreen) {
      setFullscreen(false);
      if (document.fullscreenElement) void document.exitFullscreen();
      return;
    }
    setFullscreen(true);
    // Refused (an iframe without permission, an old browser): the canvas still
    // covers the window, which is most of what was asked for.
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  }, [fullscreen]);

  return { fullscreen, toggle };
}
