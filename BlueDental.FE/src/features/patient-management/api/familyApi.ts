import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientRelationKeys, type PatientRelationRow } from "@/hooks/usePatientFamily";
import { api } from "@/lib/axios";
import type { PatientRelationType } from "@/utils/patientRelation";

/**
 * "Gia đình & Quan hệ": everyone tied to the record (Mối quan hệ 4.8, guardian
 * links 4.9, family group 4.10) and the Hồ sơ nhóm it belongs to. Guardian
 * cards are written with the hồ sơ itself.
 */

const RELATIONS = "/v1/app/patient-relations";

/** A group the patient belongs to, with every member's look-up facts. */
export interface PatientGroupOfPatient {
  id: string;
  name: string;
  /** 1 Gia đình · 2 Nhóm khác. */
  kind: number;
  note: string | null;
  sharedMedicalNote: string | null;
  memberCount: number;
  headName: string | null;
  members: {
    patientId: string;
    patientCode: string;
    fullName: string;
    gender: number;
    dateOfBirth: string | null;
    /** 1 Chủ hộ / Trưởng nhóm · 2 Thành viên. */
    role: number;
    relationToHead: PatientRelationType | null;
    diseaseHistory: string[];
    lastVisitAt: string | null;
    nextAppointmentAt: string | null;
    totalDebt: number;
  }[];
}

export interface RelationInput {
  relatedPatientId: string;
  type: PatientRelationType;
  note: string | null;
}

export const patientGroupOfKeys = {
  of: (patientId: string) => ["patient-groups", "by-patient", patientId] as const,
};

export function usePatientRelations(patientId: string, enabled = true) {
  return useQuery({
    queryKey: patientRelationKeys.list(patientId),
    queryFn: async () =>
      (await api.get<{ items: PatientRelationRow[] }>(RELATIONS, { params: { patientId } })).data.items,
    enabled,
  });
}

export function usePatientGroupsOf(patientId: string, enabled: boolean) {
  return useQuery({
    queryKey: patientGroupOfKeys.of(patientId),
    queryFn: async () =>
      (await api.get<{ items: PatientGroupOfPatient[] }>("/v1/app/patient-groups/by-patient", { params: { patientId } }))
        .data.items,
    enabled,
  });
}

/** Writes on one record's relations; both records' lists refresh, and the groups that word members by them. */
export function useRelationCommands(patientId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: patientRelationKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["patient-groups"] }),
    ]);

  const create = useMutation({
    mutationFn: (input: RelationInput) => api.post(RELATIONS, { ...input, patientId }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, type, note }: { id: string; type: PatientRelationType; note: string | null }) =>
      api.put(`${RELATIONS}/${id}`, { patientId, type, note }).then((r) => r.data),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${RELATIONS}/${id}`).then(() => undefined),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
