import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { useCreateStaffNote, useUpdateStaffNote } from "../api/staffNoteApi";
import type { StaffNoteDto, StaffNoteScope } from "../types";

export interface StaffNoteEditor {
  expanded: boolean;
  draft: string;
  /** The note being edited; null while the block adds a new one. */
  editingId: string | null;
  saving: boolean;
  toggle: () => void;
  setDraft: (value: string) => void;
  startEdit: (note: StaffNoteDto) => void;
  cancelEdit: () => void;
  submit: () => void;
}

/**
 * The "Thêm mới" block's state. It both adds and edits: "Sửa" on a row loads
 * that note into it and opens it, and the button turns into "Lưu" until the
 * edit is saved or dropped. Failures are left to the global mutation toast.
 */
export function useStaffNoteEditor(scope: StaffNoteScope, onAdded: () => void): StaffNoteEditor {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const create = useCreateStaffNote();
  const update = useUpdateStaffNote();

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft("");
  }, []);

  const startEdit = useCallback((note: StaffNoteDto) => {
    setEditingId(note.id);
    setDraft(note.content);
    setExpanded(true);
  }, []);

  const submit = () => {
    const content = draft.trim();
    if (!content) return;
    if (editingId) {
      update.mutate(
        { id: editingId, content },
        {
          onSuccess: () => {
            toast.success(t("StaffNote:Saved"));
            cancelEdit();
          },
        },
      );
      return;
    }
    create.mutate(
      { scope, content },
      {
        onSuccess: () => {
          toast.success(t("StaffNote:Added"));
          setDraft("");
          onAdded();
        },
      },
    );
  };

  return {
    expanded,
    draft,
    editingId,
    saving: create.isPending || update.isPending,
    toggle: () => setExpanded((value) => !value),
    setDraft,
    startEdit,
    cancelEdit,
    submit,
  };
}
