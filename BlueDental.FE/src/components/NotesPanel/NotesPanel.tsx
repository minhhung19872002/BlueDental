import { useEffect, useRef, useState } from "react";
import { Input } from "antd";
import { CheckOutlined, CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import "./notes-panel.css";

interface NotesPanelProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Editing a stored booking: the box opens on its note at once. */
  autoEditExisting?: boolean;
}

/**
 * The Ghi chú card of the booking dialogs: "+ Thêm ngay" opens a box whose ✓
 * appends a line to the note. Controlled through `value` / `onChange`, so an
 * AntD `Form.Item` drives it as readily as a React Hook Form field.
 */
export function NotesPanel({ value = "", onChange, autoEditExisting }: NotesPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingExisting, setEditingExisting] = useState(false);
  const autoOpened = useRef(false);

  useEffect(() => {
    if (autoEditExisting && value && !autoOpened.current) {
      autoOpened.current = true;
      setDraft(value);
      setEditingExisting(true);
      setEditing(true);
    }
  }, [autoEditExisting, value]);

  const closeEditor = () => {
    setDraft("");
    setEditingExisting(false);
    setEditing(false);
  };

  const handleAdd = () => {
    setDraft("");
    setEditingExisting(false);
    setEditing(true);
  };

  const handleConfirm = () => {
    const line = draft.trim();
    if (line) onChange?.(editingExisting || !value ? line : `${value}\n${line}`);
    closeEditor();
  };

  return (
    <div className="notes-panel">
      <div className="notes-panel-header">
        <span className="notes-panel-title">{t("Common:Note")}</span>
        {!editing && (
          <button type="button" className="notes-panel-add-btn" onClick={handleAdd}>
            <PlusOutlined /> {t("Appointment:Form:AddNote")}
          </button>
        )}
      </div>

      {value && !editing && <div className="notes-panel-content">{value}</div>}

      {editing && (
        <div className="notes-panel-edit-row">
          <Input.TextArea
            className="notes-panel-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            placeholder={t("Appointment:Form:NotePlaceholder")}
          />
          <div className="notes-panel-actions">
            <button
              type="button"
              className="notes-panel-action-btn notes-panel-action-btn--cancel"
              aria-label={t("Common:Cancel")}
              onClick={closeEditor}
            >
              <CloseOutlined />
            </button>
            <button
              type="button"
              className="notes-panel-action-btn notes-panel-action-btn--confirm"
              aria-label={t("Common:Confirm")}
              onClick={handleConfirm}
            >
              <CheckOutlined />
            </button>
          </div>
        </div>
      )}

      {!value && !editing && <span className="notes-panel-empty">{t("Appointment:Form:NoNotes")}</span>}
    </div>
  );
}
