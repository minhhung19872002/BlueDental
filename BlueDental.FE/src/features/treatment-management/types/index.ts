// TODO: Define treatment management types.

export type TreatmentStatus = "planned" | "in_progress" | "completed" | "cancelled";

export interface TreatmentPlanDto {
  id: string;
  patientId: string;
  title: string;
  status: TreatmentStatus;
  startDate: string | null;
  completedDate: string | null;
  notes: string | null;
  procedures: TreatmentProcedureDto[];
}

export interface TreatmentProcedureDto {
  id: string;
  planId: string;
  procedureId: string;
  procedureName: string;
  toothFdi: number | null;
  status: TreatmentStatus;
  price: number;
  notes: string | null;
  performedAt: string | null;
  performedBy: string | null;
}
