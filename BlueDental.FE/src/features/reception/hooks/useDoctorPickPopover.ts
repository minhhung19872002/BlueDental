import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

/** Beside the panel, or over its rows when the screen has no room left of it. */
export type DoctorPickPlacement = "side" | "over";

const SIDE_GAP = 10;
const SCREEN_EDGE = 8;

/**
 * Room is measured, not guessed from the screen width: the dock sits 24px from
 * the right, 100px beside the chat button, or further left of an open chat.
 */
function measurePlacement(popover: HTMLElement): DoctorPickPlacement {
  const anchor = popover.parentElement;
  if (!anchor) return "over";
  const roomLeft = anchor.getBoundingClientRect().left - SIDE_GAP - popover.offsetWidth;
  return roomLeft >= SCREEN_EDGE ? "side" : "over";
}

/**
 * The 👁's doctor popover (R-1164): where it stands, and folding it away on a
 * click anywhere but the popover or its 👁 (`toggleSelector`), or on Escape.
 */
export function useDoctorPickPopover(
  ref: RefObject<HTMLDivElement | null>,
  toggleSelector: string,
  onClose: () => void,
) {
  const [placement, setPlacement] = useState<DoctorPickPlacement>("side");

  useLayoutEffect(() => {
    const update = () => {
      if (ref.current) setPlacement(measurePlacement(ref.current));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [ref]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (ref.current?.contains(event.target) || event.target.closest(toggleSelector)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [ref, toggleSelector, onClose]);

  return { placement };
}
