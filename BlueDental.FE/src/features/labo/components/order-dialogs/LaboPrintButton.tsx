import { Button } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useBranchInfo } from "@/hooks/useBranchInfo";
import { t } from "@/lib/i18n";
import type { LaboOrderDto } from "@/features/labo/api/laboApi";
import { LaboPrintSheet } from "./LaboPrintSheet";
import { laboOrderFacts, type LaboDetailPatient } from "./laboOrderFacts";
import { useLaboPrint } from "./useLaboPrint";

interface Props {
  order: LaboOrderDto;
  branchId: string;
  patient: LaboDetailPatient;
}

/** "In Phiếu Labo" and the A4 sheet it prints; disabled until the clinic's letterhead is in. */
export function LaboPrintButton({ order, branchId, patient }: Props) {
  const clinic = useBranchInfo(branchId);
  const print = useLaboPrint(order.orderCode);

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
      {clinic.data && (
        <LaboPrintSheet
          clinic={clinic.data}
          patient={patient}
          orderCode={order.orderCode}
          facts={laboOrderFacts(order, patient)}
        />
      )}
    </>
  );
}
