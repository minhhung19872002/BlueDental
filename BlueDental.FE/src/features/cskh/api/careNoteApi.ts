import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/** Matches BlueDental.CustomerCare.CareNoteAction. */
export const NOTE_ACTION = { Created: 0, Edited: 1, Removed: 2 } as const;
export type NoteAction = (typeof NOTE_ACTION)[keyof typeof NOTE_ACTION];

/** Matches BlueDental.CustomerCare.CareNoteOutcome — "Kết quả cuộc gọi", fixed quick tags (BA P2210). */
export const NOTE_OUTCOME = { Contacted: 1, NoAnswer: 2 } as const;
export type NoteOutcome = (typeof NOTE_OUTCOME)[keyof typeof NOTE_OUTCOME];

/** Mirrors BlueDental.CustomerCare.CareNoteConsts. */
export const NOTE_LIMITS = { content: 2000 } as const;

export interface NoteRevision {
  action: NoteAction;
  before: string | null;
  after: string | null;
  actorName: string | null;
  at: string;
}

export interface CareNote {
  id: string;
  conversationId: string | null;
  patientId: string | null;
  content: string;
  outcome: NoteOutcome | null;
  authorId: string;
  authorName: string | null;
  createdAt: string;
  lastEditorName: string | null;
  lastEditedAt: string | null;
  isRemoved: boolean;
  removerName: string | null;
  removedAt: string | null;
  revisions: NoteRevision[];
}

/**
 * Where a list of notes is read and written: a Hộp thư Zalo conversation or a
 * patient record. Both show the same notes (BA P2210: "đồng bộ với cái ghi chú
 * ở khung chát").
 */
export type NoteOwner = { kind: "conversation"; id: string } | { kind: "patient"; id: string };

export interface SaveNoteInput {
  content: string;
  outcome?: NoteOutcome | null;
}

const ownerPath = (owner: NoteOwner) =>
  owner.kind === "conversation"
    ? `/v1/app/zalo-inbox/conversations/${owner.id}/notes`
    : `/v1/app/patients/${owner.id}/care-notes`;

const careNoteApi = {
  list: (owner: NoteOwner) => api.get<CareNote[]>(ownerPath(owner)).then((r) => r.data),
  create: ({ owner, input }: { owner: NoteOwner; input: SaveNoteInput }) =>
    api.post<CareNote>(ownerPath(owner), input).then((r) => r.data),
  update: ({ id, content }: { id: string; content: string }) =>
    api.put<CareNote>(`/v1/app/care-notes/${id}`, { content }).then((r) => r.data),
  remove: (id: string) => api.delete<CareNote>(`/v1/app/care-notes/${id}`).then((r) => r.data),
};

export const careNoteKeys = {
  all: ["care-notes"] as const,
  list: (owner: NoteOwner) => [...careNoteKeys.all, owner.kind, owner.id] as const,
};

export function useCareNotes(owner: NoteOwner) {
  return useQuery({ queryKey: careNoteKeys.list(owner), queryFn: () => careNoteApi.list(owner) });
}

/**
 * A note shows from the chat and from the record, and the record's history
 * lists it too: every note list and history goes stale with any change.
 */
function useInvalidateNotes() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: careNoteKeys.all });
    void queryClient.invalidateQueries({ queryKey: ["care-history"] });
  };
}

export function useCreateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({ mutationFn: careNoteApi.create, onSuccess: invalidate });
}

export function useUpdateNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({ mutationFn: careNoteApi.update, onSuccess: invalidate });
}

export function useDeleteNote() {
  const invalidate = useInvalidateNotes();
  return useMutation({ mutationFn: careNoteApi.remove, onSuccess: invalidate });
}
