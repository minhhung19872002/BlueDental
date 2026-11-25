import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import type { PatientImageFolderEditor } from "../../../hooks/usePatientImageFolderEditor";
import type { PatientImageFolderRemoval } from "../../../hooks/usePatientImageFolderRemoval";
import { PatientImageFolderDialog } from "./PatientImageFolderDialog";

interface Props {
  editor: PatientImageFolderEditor;
  removal: PatientImageFolderRemoval;
}

/** A column's "Thư mục mới" / "Đổi tên thư mục" dialog and its "Xoá thư mục?" (F-98). */
export function PatientImageFolderDialogs({ editor, removal }: Props) {
  const { editing } = editor;
  const removing = removal.removing;

  return (
    <>
      {editing && (
        <PatientImageFolderDialog
          key={editing.mode === "rename" ? editing.folder.id : "new"}
          title={t(editing.mode === "rename" ? "Patient:Image:FolderRenameTitle" : "Patient:Image:FolderNew")}
          initialName={editing.mode === "rename" ? editing.folder.name : ""}
          saving={editor.saving}
          onSave={(name) => void editor.save(name)}
          onClose={editor.close}
        />
      )}
      <ConfirmDeleteDialog
        open={removing !== null}
        noun={t("Patient:Image:FolderNoun")}
        name={removing?.name}
        title={removing ? t("Patient:Image:FolderDeleteTitle", removing.name) : undefined}
        note={
          removing && removing.imageCount > 0
            ? t("Patient:Image:FolderDeleteNote", removing.imageCount)
            : t("Patient:Image:FolderDeleteEmptyNote")
        }
        pending={removal.pending}
        onConfirm={() => void removal.confirm()}
        onClose={removal.cancel}
      />
    </>
  );
}
