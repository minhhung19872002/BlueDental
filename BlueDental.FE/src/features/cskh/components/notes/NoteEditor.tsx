import { useState } from "react";
import { Button, Input } from "antd";
import { t } from "@/lib/i18n";
import { NOTE_LIMITS } from "../../api/careNoteApi";

interface Props {
  initial: string;
  saving: boolean;
  saveLabel: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

/** The free-text box a note is written or changed in. */
export function NoteEditor({ initial, saving, saveLabel, onSave, onCancel }: Props) {
  const [content, setContent] = useState(initial);
  const ready = content.trim().length > 0 && content.trim() !== initial.trim() && !saving;

  return (
    <div className="cn-editor">
      <Input.TextArea
        autoFocus
        aria-label={t("CSKH:Inbox:NoteText")}
        placeholder={t("CSKH:Inbox:NotePlaceholder")}
        autoSize={{ minRows: 2, maxRows: 6 }}
        maxLength={NOTE_LIMITS.content}
        value={content}
        disabled={saving}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="cn-editor-actions">
        <Button size="small" disabled={saving} onClick={onCancel}>
          {t("Common:CancelAlt")}
        </Button>
        <Button size="small" type="primary" loading={saving} disabled={!ready} onClick={() => onSave(content.trim())}>
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
