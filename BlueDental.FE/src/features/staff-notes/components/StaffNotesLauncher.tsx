import { useCallback, useEffect, useRef, useState } from "react";
import type { InputRef } from "antd";
import { ActionTooltip } from "@/components/ActionTooltip";
import { useT } from "@/lib/i18n";
import { StaffNotesDialog } from "./StaffNotesDialog";
import "./staff-notes.css";

/** Alt+N — Ctrl+Shift is UniKey's language switch, Ctrl+N the browser's new window. */
const SHORTCUT_LABEL = "Alt+N";

function isShortcut(event: KeyboardEvent): boolean {
  // `code`, not `key`: on a Mac Option+N types "˜", and a Vietnamese layout may remap the letter.
  return event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.code === "KeyN";
}

/**
 * The header's notes button and its shortcut. The dialog lives here, under the
 * app shell, so it stays open — draft and all — while the user moves between
 * screens. The shortcut only ever opens: a dialog that is already up gets the
 * cursor put in its search box instead, since it closes by X or "Hủy" alone.
 */
export function StaffNotesLauncher() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const searchRef = useRef<InputRef>(null);

  const handleOpen = useCallback(() => {
    setOpen(true);
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isShortcut(event)) return;
      event.preventDefault();
      handleOpen();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpen]);

  return (
    <>
      <ActionTooltip title={t("StaffNote:Tooltip", SHORTCUT_LABEL)} className="staff-notes-trigger">
        <button
          type="button"
          className="app-header-icon-btn"
          aria-label={t("StaffNote:Open")}
          aria-keyshortcuts="Alt+N"
          onClick={handleOpen}
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="8" y="2" width="8" height="4" rx="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <path d="M9 12h6M9 16h4" />
          </svg>
        </button>
      </ActionTooltip>
      <StaffNotesDialog open={open} searchRef={searchRef} onClose={() => setOpen(false)} />
    </>
  );
}
