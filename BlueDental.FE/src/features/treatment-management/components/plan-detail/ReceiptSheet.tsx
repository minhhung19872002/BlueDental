import type { PatientDto } from "@/features/patient-management/types/patient";
import type { BranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import { moneyInWords } from "@/utils/moneyWords";
import { moneyText } from "../plan/planTypes";
import type { ReceiptView } from "./receiptView";

interface Props {
  receipt: ReceiptView;
  patient: PatientDto;
  clinic: BranchInfo | undefined;
  /** Who signs "Người lập phiếu". */
  preparerName: string | null;
}

interface Row {
  label: string;
  value: string;
}

function Group({ rows }: { rows: Row[] }) {
  return (
    <dl className="pdt-sheet-group">
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
 * The sheet that actually reaches the printer behind "In Hoá Đơn": the
 * clinic's letterhead, "BIÊN LAI THU TIỀN", the customer, the sum in figures
 * and in words, and the two signature blocks — as the reference prints it.
 * Kept off-screen; the print rules in plan-detail.css show only this.
 */
export function ReceiptSheet({ receipt, patient, clinic, preparerName }: Props) {
  const services = receipt.lines.map((line) => line.service.serviceName ?? line.service.code).join(", ");
  return (
    <div className="pdt-sheet" aria-hidden="true">
      <header className="pdt-sheet-clinic">
        <strong>{clinic?.name ?? ""}</strong>
        <p>{clinic?.address ?? ""}</p>
        <p>{clinic?.phone ?? ""}</p>
      </header>
      <h2 className="pdt-sheet-title">{t("Biên lai thu tiền")}</h2>
      <p className="pdt-sheet-sub">{t("Hoá đơn chỉ được xuất trong ngày")}</p>

      <Group
        rows={[
          { label: t("Ngày"), value: receipt.sheetDateLabel },
          { label: t("Nhân viên"), value: receipt.staffName ?? "" },
        ]}
      />
      <Group
        rows={[
          { label: t("Khách hàng"), value: `[${patient.patientCode}] ${patient.fullName}` },
          { label: t("ĐT"), value: patient.phoneNumber ?? "" },
          { label: t("Địa chỉ"), value: patient.address ?? "" },
        ]}
      />
      <Group
        rows={[
          { label: t("Thành tiền"), value: moneyText(receipt.amount) },
          { label: t("Số tiền bằng chữ"), value: moneyInWords(receipt.amount) },
          { label: t("Phương thức TT"), value: receipt.methodLabel },
          { label: t("Dịch vụ"), value: services },
          { label: t("Nội dung TT"), value: receipt.note },
        ]}
      />

      <div className="pdt-sheet-signs">
        <div>
          <p>{t("Người lập phiếu")}</p>
          <p>{preparerName ?? ""}</p>
        </div>
        <div>
          <p>{t("Khách hàng")}</p>
          <p>{patient.fullName}</p>
        </div>
      </div>
    </div>
  );
}
