// TODO: Define reporting types.

export interface RevenueReportDto {
  period: string;
  totalRevenue: number;
  totalInvoices: number;
  totalPatients: number;
}

export interface PatientStatisticsDto {
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  byGender: { male: number; female: number; other: number };
}
