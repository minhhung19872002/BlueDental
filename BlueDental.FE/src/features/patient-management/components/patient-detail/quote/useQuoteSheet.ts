import { useMemo } from "react";
import { useAuthStore } from "@/features/auth/store/authStore";
import type {
  PatientAdviseDto,
  PatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { formatDate } from "@/utils/format";
import { usePatient } from "../../../api/patientQueries";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import {
  quoteTotals,
  toQuoteRow,
  type QuoteClinic,
  type QuoteCustomer,
  type QuoteImage,
  type QuoteRow,
  type QuoteTotals,
} from "./quoteModel";

interface Input {
  patientId: string;
  branchId: string;
  rows: PatientAdviseDto[];
  diagnoses: PatientDiagnosisDto[];
  images: PatientImageViewModel[];
  /** The plan voucher picked under the sheet — printed as "Giảm giá bác sĩ". */
  voucherDiscount: number;
}

export interface QuoteSheetData {
  clinic: QuoteClinic;
  customer: QuoteCustomer;
  rows: QuoteRow[];
  totals: QuoteTotals;
  images: QuoteImage[];
}

/**
 * Everything the quote and its two sheets print: the branch from its own
 * record, the patient from theirs, the ticked advise rows re-shaped, and the
 * album as plain src/alt pairs.
 */
export function useQuoteSheet({
  patientId,
  branchId,
  rows,
  diagnoses,
  images,
  voucherDiscount,
}: Input): QuoteSheetData {
  const branch = useBranchInfo(branchId).data;
  const patient = usePatient(patientId).data;
  const user = useAuthStore((s) => s.user);

  const quoteRows = useMemo(() => {
    const slips = new Map(diagnoses.map((slip) => [slip.id, slip]));
    return rows.map((row) => toQuoteRow(row, slips));
  }, [rows, diagnoses]);

  const quoteImages = useMemo(
    () => images.map((image) => ({ id: image.id, src: image.url, alt: image.fileName })),
    [images],
  );

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
      address: patient?.address ?? "",
      dateOfBirth: patient?.dateOfBirth ? formatDate(patient.dateOfBirth) : "-",
    },
    rows: quoteRows,
    totals: quoteTotals(quoteRows, voucherDiscount),
    images: quoteImages,
  };
}
