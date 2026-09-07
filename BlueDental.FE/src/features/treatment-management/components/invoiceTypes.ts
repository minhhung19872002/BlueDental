import type { Dayjs } from "dayjs";
import type { PatientDto } from "@/features/patient-management/types/patient";
import type { TreatmentPlanSlipDto } from "../api/treatmentPlanApi";

export interface InvoiceTemplate {
  id: string;
  label: string;
  symbol: string;
}

export type InvoicePaymentMethod = "cash" | "transfer";

export interface InvoiceServiceRow {
  key: string;
  stt: number;
  serviceName: string;
  taxType: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxBasePrice: number;
  taxPercent: string;
  taxAmount: number;
  totalAfterTax: number;
  selected: boolean;
}

export interface InvoiceFormState {
  customerName: string;
  nationalId: string;
  companyName: string;
  address: string;
  taxCode: string;
  email: string;
  phone: string;
  templateId: string;
  templateSymbol: string;
  invoiceDate: Dayjs;
  paymentMethod: InvoicePaymentMethod;
  currency: string;
  exchangeRate: number;
}

export interface InvoiceModalProps {
  open: boolean;
  patient: PatientDto;
  plan: TreatmentPlanSlipDto;
  onClose: () => void;
}
