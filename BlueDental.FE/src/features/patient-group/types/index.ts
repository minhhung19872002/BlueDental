import type { PatientRelationType } from "@/utils/patientRelation";

/**
 * Hồ sơ nhóm (function list 4.10). BlueDental-local — the reference has no
 * patient groups; decisions in docs/clone/pages/patient-relations.md. Mirrors
 * the DTOs of BlueDental.PatientManagement.
 */

/** Mirrors BlueDental.PatientManagement.PatientGroupKind. */
export const GROUP_KIND = { Family: 1, Other: 2 } as const;
export type GroupKind = (typeof GROUP_KIND)[keyof typeof GROUP_KIND];

/** Mirrors BlueDental.PatientManagement.PatientGroupRole. */
export const GROUP_ROLE = { Head: 1, Member: 2 } as const;
export type GroupRole = (typeof GROUP_ROLE)[keyof typeof GROUP_ROLE];

export interface PatientGroupDto {
  id: string;
  name: string;
  kind: GroupKind;
  note: string | null;
  sharedMedicalNote: string | null;
  memberCount: number;
  headName: string | null;
  memberNames: string[];
  creationTime: string;
}

export interface PatientGroupMemberDto {
  patientId: string;
  patientCode: string;
  fullName: string;
  gender: number;
  dateOfBirth: string | null;
  role: GroupRole;
  relationToHead: PatientRelationType | null;
  diseaseHistory: string[];
  lastVisitAt: string | null;
  nextAppointmentAt: string | null;
  totalDebt: number;
}

export interface PatientGroupDetailDto extends PatientGroupDto {
  members: PatientGroupMemberDto[];
}

export interface SavePatientGroupInput {
  name: string;
  kind: GroupKind;
  note: string | null;
  sharedMedicalNote: string | null;
  members: { patientId: string; role: GroupRole }[];
}

/** A member while the group is being edited: who, how to show them, and their role. */
export interface MemberDraft {
  patientId: string;
  label: string;
  role: GroupRole;
}
