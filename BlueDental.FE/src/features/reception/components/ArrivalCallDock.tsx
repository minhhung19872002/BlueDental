import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { t } from "@/lib/i18n";
import { useArrivalCalls } from "../hooks/useArrivalCalls";
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
 */
export const ArrivalCallDock: React.FC = () => {
  const { visible, sections, badgeCount, pendingId, runAction, recordTarget, closeRecord } = useArrivalCalls();
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
      {recordTarget && (
        <Suspense fallback={null}>
          <TemporaryPatientDialog target={recordTarget} onClose={closeRecord} />
        </Suspense>
      )}
    </div>
  );
};
