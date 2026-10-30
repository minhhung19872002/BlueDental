import { t } from "@/lib/i18n";
import { LaboLockedField } from "../order-dialogs/LaboLockedField";

interface Props {
  orderCode: string;
  patient: { code: string; name: string };
}

/**
 * Phiếu dịch vụ Labo and Tên khách hàng above the summary of tab 2, both
 * locked (BA mock P2910_03: "Cái này lock hết nhé không cho chỉnh sửa").
 */
export function LaboOrderIdentity({ orderCode, patient }: Props) {
  return (
    <div className="pd-labo-grid pd-labo-identity">
      <LaboLockedField label={t("Patient:Labo:ServiceSlip")} value={orderCode} />
      <LaboLockedField
        label={t("Patient:Form:CustomerName")}
        value={`${patient.code} - ${patient.name}`}
        required={false}
      />
    </div>
  );
}
