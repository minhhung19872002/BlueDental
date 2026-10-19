/** Mirrors BlueDental.StaffNotes.StaffNoteScope. */
export const STAFF_NOTE_SCOPE = { Shared: 1, Personal: 2 } as const;
export type StaffNoteScope = (typeof STAFF_NOTE_SCOPE)[keyof typeof STAFF_NOTE_SCOPE];

/** Mirrors StaffNoteConsts.MaxContentLength. */
export const STAFF_NOTE_MAX_LENGTH = 2000;

export interface StaffNoteDto {
  id: string;
  scope: StaffNoteScope;
  /** The branch a "Chung" note belongs to; null on a "Cá nhân" note. */
  clinicBranchId: string | null;
  content: string;
  creatorId: string | null;
  creatorName: string | null;
  creationTime: string;
  lastModificationTime: string | null;
  /** Only the author may edit or delete; everybody else gets Copy. */
  canEdit: boolean;
}

export interface StaffNoteListQuery {
  scope: StaffNoteScope;
  filter?: string;
  skipCount: number;
  maxResultCount: number;
}

export interface CreateStaffNoteInput {
  scope: StaffNoteScope;
  content: string;
}

export interface UpdateStaffNoteInput {
  id: string;
  content: string;
}
