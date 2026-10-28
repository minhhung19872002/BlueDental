import { useState, type KeyboardEvent } from "react";
import { Button, Input } from "antd";
import { t } from "@/lib/i18n";
import { StageEditPencil } from "./stage/StageEditPencil";

/** Appointment.NotesMaxLength on the server. */
export const APPOINTMENT_NOTES_LIMIT = 2000;

interface Props {
  notes: string | null;
  saving: boolean;
  /** appointment.update — without it the cell only reads. */
  editable: boolean;
  /** Resolves true once saved; a refused save keeps the editor and its draft. */
  onSave: (notes: string) => Promise<boolean>;
}

/**
 * Ghi chú on the patient's Lịch hẹn tab (BA, R-1058). The booking dialogs no
 * longer carry it (R-1055), so it is kept up here, in place, whatever the
 * appointment's status. Esc drops the draft like Hủy.
 */
export function AppointmentNoteCell({ notes, saving, editable, onSave }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const handleSave = async () => {
    if (draft === null) return;
    // Left as it was, there is nothing to send.
    if (draft.trim() === (notes ?? "").trim() || (await onSave(draft))) setDraft(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Escape" || saving) return;
    event.stopPropagation();
    setDraft(null);
  };

  if (draft === null) {
    return (
      <div className="pd-appt-note">
        <span className="pd-appt-note-text">{notes ?? "—"}</span>
        {editable && (
          <StageEditPencil
            label={t("Patient:Appt:EditNote")}
            onClick={() => setDraft(notes ?? "")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="pd-appt-noteedit">
      <Input.TextArea
        autoFocus
        autoSize={{ minRows: 2, maxRows: 6 }}
        value={draft}
        maxLength={APPOINTMENT_NOTES_LIMIT}
        aria-label={t("Patient:Misc:Note")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div>
        <Button size="small" disabled={saving} onClick={() => setDraft(null)}>
          {t("Patient:Misc:Cancel")}
        </Button>
        <Button size="small" type="primary" loading={saving} onClick={handleSave}>
          {t("Patient:Misc:Save")}
        </Button>
      </div>
    </div>
  );
}
