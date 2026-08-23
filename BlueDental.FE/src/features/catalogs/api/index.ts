import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";

export interface DentalProcedureDto {
  id: string;
  code: string;
  name: string;
  defaultPrice: number;
  isActive: boolean;
}

export interface MedicationDto {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
}

export interface InsurancePlanDto {
  id: string;
  name: string;
  coverageRate: number;
  isActive: boolean;
}

const catalogApi = {
  dentalProcedures: (): Promise<{ items: DentalProcedureDto[]; totalCount: number }> =>
    api.get("/v1/app/dental-procedures", { params: { maxResultCount: 100 } }).then((r) => r.data),

  medications: (): Promise<{ items: MedicationDto[]; totalCount: number }> =>
    api.get("/v1/app/medications", { params: { maxResultCount: 100 } }).then((r) => r.data),

  insurancePlans: (): Promise<{ items: InsurancePlanDto[]; totalCount: number }> =>
    api.get("/v1/app/insurance-plans", { params: { maxResultCount: 100 } }).then((r) => r.data),
};

export function useDentalProcedures() {
  return useQuery({
    queryKey: ["dental-procedures"],
    queryFn: () => catalogApi.dentalProcedures(),
    select: (d) => d.items,
    staleTime: 5 * 60_000,
  });
}

export function useMedications() {
  return useQuery({
    queryKey: ["medications"],
    queryFn: () => catalogApi.medications(),
    select: (d) => d.items,
    staleTime: 5 * 60_000,
  });
}

export function useInsurancePlans() {
  return useQuery({
    queryKey: ["insurance-plans"],
    queryFn: () => catalogApi.insurancePlans(),
    select: (d) => d.items,
    staleTime: 5 * 60_000,
  });
}
