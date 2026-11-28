import { useMemo } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import type { PatientAdviseDto } from "@/features/treatment-management/api/consultingApi";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { formatDate } from "@/utils/format";
import { usePatient, usePatientDto } from "../../../api/patientQueries";
import { useAddressParts } from "../../../hooks/useGuardianSubject";
import {
  quoteTotals,
  toQuoteRow,
  type QuoteClinic,
  type QuoteCustomer,
  type QuoteRow,
  type QuoteTotals,
} from "./quoteModel";

interface Input {
  patientId: string;
  branchId: string;
  rows: PatientAdviseDto[];
  /** The plan voucher picked under the sheet — printed as "Giảm giá bác sĩ". */
  voucherDiscount: number;
}

export interface QuoteSheetData {
  clinic: QuoteClinic;
  customer: QuoteCustomer;
  rows: QuoteRow[];
  totals: QuoteTotals;
}

/**
 * Everything the quote and its sheet print: the branch from its own record
 * (both its lines, "0779 160 888 - 0767 080 333"), the patient from theirs —
 * the Địa chỉ in full, "Số nhà, Phường, Tỉnh" as the bệnh án prints it (R-1337) —
 * and the ticked advise rows re-shaped.
 */
export function useQuoteSheet({ patientId, branchId, rows, voucherDiscount }: Input): QuoteSheetData {
  const branch = useBranchInfo(branchId).data;
  const patient = usePatient(patientId).data;
  const user = useAuthStore((s) => s.user);
  // The view model drops the ward and province codes; the record keeps them.
  const record = usePatientDto(patientId).data;
  const address = useAddressParts(record?.address, record?.provinceCode, record?.wardCode);

  const quoteRows = useMemo(() => rows.map(toQuoteRow), [rows]);

  return {
    clinic: {
      name: branch?.name || user?.clinicName || "",
      address: branch?.address ?? "",
      phone: branch?.phone ?? "",
      email: branch?.email ?? "",
      logoUrl: user?.clinicLogoUrl ?? null,
    },
    customer: {
      code: patient?.code ?? "",
      name: patient?.fullName ?? "",
      phone: patient?.phone ?? "",
      address: address.full,
      dateOfBirth: patient?.dateOfBirth ? formatDate(patient.dateOfBirth) : "-",
    },
    rows: quoteRows,
    totals: quoteTotals(quoteRows, voucherDiscount),
  };
}
