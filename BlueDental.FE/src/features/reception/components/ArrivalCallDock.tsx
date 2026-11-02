import React, { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { t } from "@/lib/i18n";
import { useArrivalCalls } from "../hooks/useArrivalCalls";
import { ArrivalCallPanel } from "./ArrivalCallPanel";

/**
 * The round button in the bottom-right corner of Tiếp nhận: its badge counts
 * the patients waiting for the viewer, a click opens the list and a click
 * anywhere else folds it away.
 */
export const ArrivalCallDock: React.FC = () => {
  const { visible, sections, badgeCount, pendingId, runAction } = useArrivalCalls();
  const [open, setOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && dockRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (!visible) return null;

  return (
    <div className="arrival-dock" ref={dockRef}>
      {open && <ArrivalCallPanel sections={sections} pendingId={pendingId} onAction={runAction} />}
      <button
        type="button"
        className={["arrival-dock-button", open && "arrival-dock-button--open"].filter(Boolean).join(" ")}
        aria-label={t("Reception:ArrivalCallOpen")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Users size={26} aria-hidden />
        {badgeCount > 0 && <span className="arrival-dock-badge">{badgeCount > 99 ? "99+" : badgeCount}</span>}
      </button>
    </div>
  );
};
