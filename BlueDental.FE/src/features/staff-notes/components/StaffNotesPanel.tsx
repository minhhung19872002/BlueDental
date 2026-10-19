import { useState, type RefObject } from "react";
import { Input, type InputRef } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useBranchStore } from "@/lib/clinicBranch";
import { useT } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import { useDeleteStaffNote, useStaffNotes } from "../api/staffNoteApi";
import { useStaffNoteEditor } from "../hooks/useStaffNoteEditor";
import { STAFF_NOTE_SCOPE, type StaffNoteDto } from "../types";
import { StaffNoteComposer } from "./StaffNoteComposer";
import { StaffNoteTable } from "./StaffNoteTable";

type ScopeKey = "shared" | "personal";

const SCOPE_BY_KEY = { shared: STAFF_NOTE_SCOPE.Shared, personal: STAFF_NOTE_SCOPE.Personal } as const;

const PAGE_SIZE = 10;

interface Props {
  searchRef: RefObject<InputRef | null>;
}

/** The dialog's body: search + Chung/Cá nhân, the "Thêm mới" block, the list. */
export function StaffNotesPanel({ searchRef }: Props) {
  const t = useT();
  const branchId = useBranchStore((s) => s.currentBranchId);
  const [scopeKey, setScopeKey] = useState<ScopeKey>("shared");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<StaffNoteDto | null>(null);
  const filter = useDebounce(search.trim(), 300);
  const pagination = useTablePagination(PAGE_SIZE);
  const scope = SCOPE_BY_KEY[scopeKey];
  const editor = useStaffNoteEditor(scope, pagination.resetToFirstPage);
  const remove = useDeleteStaffNote();

  const { data, isFetching } = useStaffNotes(branchId, {
    scope,
    filter: filter || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const handleScopeChange = (key: ScopeKey) => {
    setScopeKey(key);
    editor.cancelEdit();
    pagination.resetToFirstPage();
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    pagination.resetToFirstPage();
  };

  const handleCopy = async (note: StaffNoteDto) => {
    try {
      await navigator.clipboard.writeText(note.content);
      toast.success(t("StaffNote:Copied"));
    } catch {
      // No clipboard on a plain-HTTP host, or the browser refused it.
      notifyError(t("StaffNote:CopyFailed"));
    }
  };

  const handleDelete = () => {
    if (!deleting) return;
    const id = deleting.id;
    remove.mutate(id, {
      onSuccess: () => {
        toast.success(t("StaffNote:Deleted"));
        setDeleting(null);
        if (editor.editingId === id) editor.cancelEdit();
      },
    });
  };

  return (
    <div className="staff-notes-body">
      <div className="staff-notes-toolbar">
        <Input
          ref={searchRef}
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t("StaffNote:Search")}
          aria-label={t("StaffNote:Search")}
          value={search}
          onChange={(event) => handleSearchChange(event.target.value)}
        />
        <SegmentedTabs<ScopeKey>
          items={[
            { key: "shared", label: t("StaffNote:Scope:Shared") },
            { key: "personal", label: t("StaffNote:Scope:Personal") },
          ]}
          activeKey={scopeKey}
          onChange={handleScopeChange}
        />
      </div>
      <StaffNoteComposer editor={editor} addLocked={scopeKey === "shared" && branchId === null} />
      <StaffNoteTable
        notes={data?.items ?? []}
        loading={isFetching}
        showAuthor={scopeKey === "shared"}
        pagination={pagination.buildConfig(data?.totalCount)}
        onEdit={editor.startEdit}
        onDelete={setDeleting}
        onCopy={(note) => void handleCopy(note)}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        noun={t("StaffNote:DeleteNoun")}
        question={t("StaffNote:DeleteQuestion")}
        pending={remove.isPending}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
