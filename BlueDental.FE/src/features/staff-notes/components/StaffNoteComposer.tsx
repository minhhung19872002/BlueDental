import { Button, Input } from "antd";
import { DownOutlined, PlusOutlined, SaveOutlined, UpOutlined } from "@ant-design/icons";
import { useT } from "@/lib/i18n";
import type { StaffNoteEditor } from "../hooks/useStaffNoteEditor";
import { STAFF_NOTE_MAX_LENGTH } from "../types";

interface Props {
  editor: StaffNoteEditor;
  /** "Chung" with no branch picked: there is nowhere to file a new shared note. */
  addLocked: boolean;
}

const TEXTAREA_ID = "staff-note-draft";

/** "Thêm mới" — folded by default; ^ opens it, and "Sửa" on a row opens it too. */
export function StaffNoteComposer({ editor, addLocked }: Props) {
  const t = useT();
  const editing = editor.editingId !== null;
  const locked = addLocked && !editing;
  const title = editing ? t("StaffNote:Composer:EditTitle") : t("StaffNote:Composer:Title");

  return (
    <section className="staff-notes-composer">
      <button
        type="button"
        className="staff-notes-composer-head"
        aria-expanded={editor.expanded}
        aria-controls={TEXTAREA_ID}
        onClick={editor.toggle}
      >
        <span className="staff-notes-composer-title">{title}</span>
        <span className="staff-notes-composer-chevron" aria-label={editor.expanded ? t("StaffNote:Collapse") : t("StaffNote:Expand")}>
          {editor.expanded ? <UpOutlined /> : <DownOutlined />}
        </span>
      </button>
      {editor.expanded && (
        <div className="staff-notes-composer-body">
          <label htmlFor={TEXTAREA_ID} className="staff-notes-label">
            {t("StaffNote:Composer:Label")}
          </label>
          <Input.TextArea
            id={TEXTAREA_ID}
            value={editor.draft}
            onChange={(event) => editor.setDraft(event.target.value)}
            placeholder={t("StaffNote:Composer:Placeholder")}
            maxLength={STAFF_NOTE_MAX_LENGTH}
            showCount
            autoSize={{ minRows: 3, maxRows: 8 }}
            disabled={locked}
          />
          {locked && <p className="staff-notes-hint">{t("StaffNote:Composer:PickBranch")}</p>}
          <div className="staff-notes-composer-actions">
            {editing && (
              <Button disabled={editor.saving} onClick={editor.cancelEdit}>
                {t("StaffNote:Composer:CancelEdit")}
              </Button>
            )}
            <Button
              type="primary"
              icon={editing ? <SaveOutlined /> : <PlusOutlined />}
              loading={editor.saving}
              disabled={locked || editor.saving || !editor.draft.trim()}
              onClick={editor.submit}
            >
              {editing ? t("StaffNote:Composer:Save") : t("StaffNote:Composer:Add")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
