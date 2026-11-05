import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useArrivalCalls } from "../hooks/useArrivalCalls";
import { ArrivalCallDockButton } from "./ArrivalCallDockButton";
import { ArrivalCallPanel } from "./ArrivalCallPanel";
import "./arrival-call.css";

// Loaded on demand: the app shell mounts the dock, and a static import would
// pull the record form and its patient.css into the main bundle, ahead of
// index.css's modal rules — which then zeroed the form's field gaps.
const TemporaryPatientDialog = lazy(() =>
  import("./TemporaryPatientDialog").then((m) => ({ default: m.TemporaryPatientDialog })),
);

/**
 * The round button in the bottom-right corner of every screen (the app shell
 * mounts it, owner 2026-11-02): its badge counts the patients waiting for the
 * viewer, a click opens the list and a click anywhere else folds it away.
 * Opening the list also stops the blink of a chime the browser blocked.
 */
export const ArrivalCallDock: React.FC = () => {
  const calls = useArrivalCalls();
  const { visible, sections, pendingId, runAction, recordTarget, closeRecord, acknowledgeChime } = calls;
  const [open, setOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  // While "Tạo hồ sơ" is up its clicks land outside the dock; the panel stays.
  useEffect(() => {
    if (!open || recordTarget) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && dockRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, recordTarget]);

  if (!visible) return null;

  const flagged = sections.some((section) => section.items.some((item) => item.isFlagged));

  const handleToggle = () => {
    setOpen((v) => !v);
    acknowledgeChime();
  };

  return (
    <div className="arrival-dock" ref={dockRef}>
      {open && <ArrivalCallPanel sections={sections} pendingId={pendingId} onAction={runAction} />}
      <ArrivalCallDockButton
        open={open}
        badgeCount={calls.badgeCount}
        soundOff={calls.soundOff}
        missedChime={calls.missedChime}
        flagged={flagged}
        onToggle={handleToggle}
      />
      {recordTarget && (
        <Suspense fallback={null}>
          <TemporaryPatientDialog target={recordTarget} onClose={closeRecord} />
        </Suspense>
      )}
    </div>
  );
};
