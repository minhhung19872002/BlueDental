import type { PatientDto } from "@/features/patient-management/types/patient";
import type { BranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import { moneyText } from "../plan/planTypes";
import type { SlipView } from "./slipView";

interface Props {
  slip: SlipView;
  patient: PatientDto;
  clinic: BranchInfo | undefined;
  dentistName: string | null;
}

interface Row {
  label: string;
  value: string;
}

function Facts({ rows }: { rows: Row[] }) {
  return (
    <dl className="pdt-slip-sheet-facts">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The sheet behind "In Phiếu" of the slip's "Chi tiết phiếu": the clinic on
 * the left, "PHIẾU ĐIỀU TRỊ" and the date in the middle, the customer on the
 * right, a ruled table of the lines, the money summary and two signature
 * blocks — as the reference prints it. Off-screen; the print rules in
 * plan-detail.css show only this.
 */
export function PlanSlipSheet({ slip, patient, clinic, dentistName }: Props) {
  return (
    <div className="pdt-sheet pdt-slip-sheet" aria-hidden="true">
      <header className="pdt-slip-sheet-head">
        <Facts
          rows={[
            { label: t("Phòng khám"), value: clinic?.name ?? "" },
            { label: t("Địa chỉ"), value: clinic?.address ?? "" },
            { label: t("ĐT"), value: clinic?.phone ?? "" },
            { label: t("Email"), value: clinic?.email ?? "" },
          ]}
        />
        <div className="pdt-slip-sheet-title">
          <h2>{t("Phiếu điều trị")}</h2>
          <p>{slip.dateLabel}</p>
        </div>
        <Facts
          rows={[
            { label: t("Mã KH"), value: patient.patientCode },
            { label: t("Họ và tên"), value: patient.fullName },
          ]}
        />
      </header>

      <table className="pdt-slip-sheet-table">
        <thead>
          <tr>
            <th>{t("Dịch vụ")}</th>
            <th>{t("Trạng thái")}</th>
            <th>{t("Bác sĩ")}</th>
            <th>{t("Đơn giá")}</th>
            <th>{t("Thành tiền")}</th>
          </tr>
        </thead>
        <tbody>
          {slip.lines.map((line) => (
            <tr key={line.service.id}>
              <td>
                {line.teethLabel && <strong>{line.teethLabel}</strong>}
                <span>{line.service.serviceName ?? line.service.code}</span>
              </td>
              <td>{line.statusLabel}</td>
              <td>{dentistName ?? ""}</td>
              <td>{line.unitLabel}</td>
              <td>
                <strong>{moneyText(line.service.effectiveAmount)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="pdt-slip-sheet-sum">
        <h3>{t("Tổng thanh toán dịch vụ")}</h3>
        <dl>
          {slip.totals.map((total) => (
            <div key={total.label}>
              <dt>{total.label}</dt>
              <dd>{moneyText(total.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="pdt-slip-sheet-signs">
        <div>
          <p>{t("Người lập phiếu")}</p>
          <em>{t("(Ký, họ tên)")}</em>
          <strong>{dentistName ?? ""}</strong>
        </div>
        <div>
          <p>{t("Khách hàng")}</p>
          <em>{t("(Ký, họ tên)")}</em>
          <strong>{patient.fullName}</strong>
        </div>
      </div>
    </div>
  );
}
