import { Link } from "react-router-dom";
import { formatDate } from "@/utils/format";
import { careGenderLabels, type CareGender } from "../api/careApi";

interface PatientCellProps {
  patientId: string;
  code: string | null;
  name: string | null;
  gender: CareGender | null;
  dateOfBirth: string | null;
  branchId: string;
}

/**
 * The Họ và tên cell every CSKH table shares: "[MÃ] - TÊN" linking to the
 * patient profile, with a muted "Giới tính - dd/MM/yyyy" line underneath.
 */
export function PatientCell({
  patientId,
  code,
  name,
  gender,
  dateOfBirth,
  branchId,
}: PatientCellProps) {
  const subtitle = [gender ? careGenderLabels()[gender] : null, dateOfBirth ? formatDate(dateOfBirth) : null]
    .filter(Boolean)
    .join(" - ");

  return (
    <div>
      <Link
        className="cskh-patient-link"
        to={`/patient/${patientId}?branchId=${branchId}`}
      >
        {code ? `[${code}] - ${name ?? ""}` : name}
      </Link>
      {subtitle && <div className="cskh-patient-sub">{subtitle}</div>}
    </div>
  );
}
