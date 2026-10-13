import { useCallback, useEffect, useRef, useState } from "react";

interface DropdownPos {
  top: number;
  left: number;
  width: number;
}

/**
 * A dropdown painted into document.body under its trigger, the way SearchSelect
 * draws its own: it follows the trigger on scroll and resize, and a mousedown
 * outside both closes it.
 */
export function usePortalDropdown(onClose: () => void) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    setOpen(false);
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      hide();
    };
    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, hide, place]);

  return { open, pos, triggerRef, dropdownRef, show, hide };
}
