import { Button } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import { isRequestSlip, laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboPrintSheet } from "./LaboPrintSheet";
import { LaboRequestSlipSheet } from "./LaboRequestSlipSheet";
import { laboOrderFacts, type LaboDetailPatient } from "./laboOrderFacts";
import { useLaboPrint } from "./useLaboPrint";

interface Props {
  order: LaboOrderDto;
  branchId: string;
  patient: LaboDetailPatient;
}

/** "In Phiếu Labo" and the A4 sheet it prints — the Phiếu yêu cầu sheet for F-91 orders, the old one for the rest; disabled until the clinic's letterhead is in. */
export function LaboPrintButton({ order, branchId, patient }: Props) {
  const clinic = useBranchInfo(branchId);
  const print = useLaboPrint(laboOrderNo(order));

  return (
    <>
      <Button
        color="primary"
        variant="outlined"
        icon={<PrinterOutlined />}
        onClick={print}
        disabled={!clinic.data}
      >
        {t("Patient:Labo:Print")}
      </Button>
      {clinic.data && isRequestSlip(order) && <LaboRequestSlipSheet clinic={clinic.data} patient={patient} order={order} />}
      {clinic.data && !isRequestSlip(order) && (
        <LaboPrintSheet
          clinic={clinic.data}
          patient={patient}
          orderCode={laboOrderNo(order)}
          facts={laboOrderFacts(order, patient)}
        />
      )}
    </>
  );
}
