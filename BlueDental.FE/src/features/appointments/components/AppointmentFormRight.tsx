import { useState } from "react";
import { Input } from "antd";
import { PlusOutlined, CloseOutlined, CheckOutlined } from "@ant-design/icons";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import { t } from "@/lib/i18n";
import type { AppointmentEditorValues } from "./AppointmentEditorForm";

interface Props {
  control: Control<AppointmentEditorValues>;
  setValue: UseFormSetValue<AppointmentEditorValues>;
  notesValue: string;
}

export function AppointmentFormRight({ control, setValue, notesValue }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const hasNotes = Boolean(notesValue);

  const handleAdd = () => {
    setDraft("");
    setEditing(true);
  };

  const handleConfirm = () => {
    if (draft.trim()) {
      const combined = notesValue ? `${notesValue}\n${draft.trim()}` : draft.trim();
      setValue("notes", combined);
    }
    setDraft("");
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft("");
    setEditing(false);
  };

  return (
    <div className="appt-notes-panel">
      <div className="appt-notes-header">
        <span className="appt-notes-title">{t("Ghi chú")}</span>
        {!editing && (
          <button type="button" className="appt-notes-add-btn" onClick={handleAdd}>
            <PlusOutlined /> {t("Thêm ngay")}
          </button>
        )}
      </div>

      {hasNotes && !editing && (
        <div className="appt-notes-content">{notesValue}</div>
      )}

      {editing && (
        <div className="appt-notes-edit-row">
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            placeholder={t("Nội dung ghi chú")}
            style={{ resize: "none", flex: 1 }}
          />
          <div className="appt-notes-actions">
            <button type="button" className="appt-notes-action-btn appt-notes-action-btn--cancel" onClick={handleCancel}>
              <CloseOutlined />
            </button>
            <button type="button" className="appt-notes-action-btn appt-notes-action-btn--confirm" onClick={handleConfirm}>
              <CheckOutlined />
            </button>
          </div>
        </div>
      )}

      {!hasNotes && !editing && (
        <span className="appt-notes-empty">{t("Chưa có ghi chú")}</span>
      )}

      {/* Hidden controller to keep RHF in sync */}
      <Controller name="notes" control={control} render={() => <></>} />
    </div>
  );
}
