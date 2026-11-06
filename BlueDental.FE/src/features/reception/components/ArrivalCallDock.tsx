import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useArrivalCalls } from "../hooks/useArrivalCalls";
import { ArrivalCallDockButton } from "./ArrivalCallDockButton";
import { ArrivalCallPanel } from "./ArrivalCallPanel";
import { ArrivalDoctorPickPopover, ArrivalDoctorPickToggle } from "./ArrivalDoctorPicker";
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
  const { visible, sections, pendingId, runAction, recordTarget, closeRecord, acknowledgeChime, doctorPicker } = calls;
  const [open, setOpen] = useState(false);
  // The 👁's doctor popover (R-1164): folded again whenever the panel closes.
  const [pickOpen, setPickOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const closePick = useCallback(() => setPickOpen(false), []);

  // While "Tạo hồ sơ" is up its clicks land outside the dock; the panel stays.
  useEffect(() => {
    if (!open || recordTarget) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && dockRef.current?.contains(event.target)) return;
      setOpen(false);
      setPickOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, recordTarget]);

  if (!visible) return null;

  const handleToggle = () => {
    setOpen((v) => !v);
    setPickOpen(false);
    acknowledgeChime();
  };

  const handlePickToggle = () => setPickOpen((v) => !v);

  const titleExtras = doctorPicker
    ? { invite: <ArrivalDoctorPickToggle open={pickOpen} onToggle={handlePickToggle} /> }
    : undefined;

  return (
    <div className="arrival-dock" ref={dockRef}>
      {open && (
        // The anchor is the panel's box: the popover stands beside it.
        <div className="arrival-panel-anchor">
          <ArrivalCallPanel sections={sections} pendingId={pendingId} onAction={runAction} titleExtras={titleExtras} />
          {pickOpen && doctorPicker && <ArrivalDoctorPickPopover {...doctorPicker} onClose={closePick} />}
        </div>
      )}
      <ArrivalCallDockButton
        open={open}
        badgeCount={calls.badgeCount}
        soundOff={calls.soundOff}
        missedChime={calls.missedChime}
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
