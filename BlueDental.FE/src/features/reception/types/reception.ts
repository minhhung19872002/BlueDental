export type ReceptionStatus = "Arrived" | "InProgress" | "Completed" | "All";

export type PatientType = "New" | "Returning";

export type RefType = "Medical" | "Self" | "Referral" | "Marketing";

export interface ReceptionItem {
  id: string;
  voucherCode: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientType: PatientType;
  doctorId: string;
  doctorName: string;
  adviseDoctorName?: string;
  refType: RefType;
  status: ReceptionStatus;
  totalDue: number;
  expectedRevenue: number;
  services: string[];
  notes?: string;
  arrivalTime: string;
  createdAt: string;
}

export interface ReceptionFilter {
  status?: ReceptionStatus;
  keyword?: string;
  doctorId?: string;
  date?: string;
  page?: number;
  pageSize?: number;
}

export interface ReceptionMetrics {
  totalCount: number;
  newPatientsCount: number;
  oldPatientsCount: number;
  scheduledCount: number;
  cancelledCount: number;
  arrivedCount: number;
  inProgressCount: number;
  completedCount: number;
}

export interface CreateReceptionInput {
  patientName: string;
  phoneNumber: string;
  dateOfBirth?: string;
  doctorId: string;
  refType: RefType;
  notes?: string;
  services?: string[];
}
