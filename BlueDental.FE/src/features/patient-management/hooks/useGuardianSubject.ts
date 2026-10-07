import { useEffect, useState } from "react";
import { Form, type FormInstance } from "antd";
import type { Dayjs } from "dayjs";
import { getProvinceName, getWardName } from "@/utils/vietnamLocations";
import type { Gender } from "../types/patient";
import { ageByYear, requiresGuardian } from "../utils/guardian";

/** The hồ sơ fields the guardian popup reads; the dialog's form holds more. */
export interface GuardianSubjectFields {
  codeSequence: string;
  fullName: string;
  gender: Gender;
  dateOfBirth: Dayjs | null;
  address: string;
  provinceCode?: string;
  wardCode?: string;
}

/** "Số nhà, Phường, Tỉnh" — the ward and province resolved from their codes. */
function useAddressLabel(address: string, provinceCode?: string, wardCode?: string): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getWardName(provinceCode, wardCode), getProvinceName(provinceCode)]).then(([ward, province]) => {
      if (!cancelled) setLabel([address.trim(), ward, province].filter(Boolean).join(", "));
    });
    return () => {
      cancelled = true;
    };
  }, [address, provinceCode, wardCode]);

  return label;
}

/**
 * The patient as the hồ sơ dialog holds them right now — before it is saved —
 * and whether that age needs a guardian (BA: current year − birth year < 16).
 */
export function useGuardianSubject<T extends GuardianSubjectFields>(form: FormInstance<T>, codePrefix: string) {
  const values = Form.useWatch((all: T) => all, form);
  const dateOfBirth = values?.dateOfBirth ?? null;
  const age = ageByYear(dateOfBirth);
  const address = useAddressLabel(values?.address ?? "", values?.provinceCode, values?.wardCode);
  const sequence = values?.codeSequence?.trim() ?? "";

  return {
    summary: {
      fullName: values?.fullName ?? "",
      code: sequence ? `${codePrefix}${sequence}` : "",
      gender: values?.gender ?? "male",
      dateOfBirth,
      age,
      required: requiresGuardian(age),
    },
    address,
  };
}
