// TODO: Define catalog types (dental procedures, materials, service categories).

export interface DentalProcedureDto {
  id: string;
  code: string;
  name: string;
  category: string;
  defaultPrice: number;
  durationMinutes: number;
}

export interface MaterialDto {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitPrice: number;
}
