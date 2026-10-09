import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import { usePatientOption } from "@/hooks/usePatientOptions";
import { t } from "@/lib/i18n";
import { usePatientGroup, usePatientGroupCommands, type GroupListFilter } from "../api/patientGroupApi";
import { GROUP_ROLE, type GroupKind, type MemberDraft, type PatientGroupDetailDto, type PatientGroupDto, type SavePatientGroupInput } from "../types";

type Editing = PatientGroupDetailDto | { seed: MemberDraft | null } | null;

/**
 * State of the Hồ sơ nhóm page: filters, the open group, the form and the
 * delete prompt. The patient record links here with `?open=<group>` (view a
 * group) or `?new=<patient>` (a new group seeded with that record as head).
 */
export function useGroupPage() {
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState("");
  const [kind, setKind] = useState<GroupKind | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewingId, setViewingId] = useState<string | null>(() => params.get("open"));
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<PatientGroupDto | null>(null);
  // "Sửa" on a list row has only the summary; the members come with the detail.
  const [editLoadId, setEditLoadId] = useState<string | null>(null);
  const editLoad = usePatientGroup(editLoadId);
  useEffect(() => {
    if (!editLoadId || !editLoad.data) return;
    setEditing(editLoad.data);
    setEditLoadId(null);
  }, [editLoadId, editLoad.data]);
  const commands = usePatientGroupCommands();
  const debounced = useDebounce(keyword, 300);

  const seedId = params.get("new") ?? undefined;
  const seed = usePatientOption(seedId);
  useEffect(() => {
    if (!seedId || !seed.data) return;
    setEditing({ seed: { patientId: seed.data.id, label: `[${seed.data.code}] - ${seed.data.name}`, role: GROUP_ROLE.Head } });
    setParams((current) => {
      current.delete("new");
      return current;
    }, { replace: true });
  }, [seedId, seed.data, setParams]);

  const query = useMemo<GroupListFilter>(
    () => ({ filter: debounced.trim(), kind, skipCount: (page - 1) * pageSize, maxResultCount: pageSize }),
    [debounced, kind, page, pageSize],
  );

  const save = async (input: SavePatientGroupInput) => {
    try {
      const saved =
        editing && "seed" in editing
          ? await commands.create.mutateAsync(input)
          : editing
            ? await commands.update.mutateAsync({ id: editing.id, input })
            : null;
      toast.success(t("PatientGroup:Saved"));
      setEditing(null);
      if (saved) setViewingId(saved.id);
    } catch {
      // The query client reports the server's refusal (e.g. already in a family); the form stays open.
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await commands.remove.mutateAsync(deleting.id);
      toast.success(t("PatientGroup:Deleted"));
      setDeleting(null);
    } catch {
      // Reported by the query client.
    }
  };

  return {
    query,
    keyword,
    setKeyword: (v: string) => {
      setKeyword(v);
      setPage(1);
    },
    kind,
    setKind: (v: GroupKind | undefined) => {
      setKind(v);
      setPage(1);
    },
    page,
    pageSize,
    setPage: (next: number, size: number) => {
      setPage(size === pageSize ? next : 1);
      setPageSize(size);
    },
    viewingId,
    view: (group: PatientGroupDto) => setViewingId(group.id),
    closeView: () => setViewingId(null),
    editing,
    openNew: () => setEditing({ seed: null }),
    openEdit: (group: PatientGroupDetailDto) => {
      setViewingId(null);
      setEditing(group);
    },
    openEditRow: (group: PatientGroupDto) => setEditLoadId(group.id),
    closeForm: () => setEditing(null),
    save,
    saving: commands.create.isPending || commands.update.isPending,
    deleting,
    askDelete: setDeleting,
    cancelDelete: () => setDeleting(null),
    confirmDelete,
    removing: commands.remove.isPending,
  };
}
