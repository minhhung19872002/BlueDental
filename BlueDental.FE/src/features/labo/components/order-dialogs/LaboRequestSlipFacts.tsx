import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { LABO_CASE_TYPE, laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import type { LaboPill } from "@/features/labo/api/laboStatus";
import { Block, StatusPill } from "./LaboDetailFacts";
import type { LaboDetailPatient } from "./laboOrderFacts";
import { laboFinishLinesText, laboShadeZonesText, laboWorkOf } from "./laboRequestSlipText";

interface Props {
  order: LaboOrderDto;
  patient: LaboDetailPatient;
  pill: LaboPill;
}

/**
 * "Xem chi tiết" of a Phiếu yêu cầu order (F-91): the same four quarters as
 * the old form, filled with what the new slip asks — Mã số and Loại phiếu,
 * Loại phục hình, the six-cell Màu răng and the Đường hoàn tất list. No
 * supplier, Khớp cắn or Kiểu nhịp: the slip no longer has them.
 */
export function LaboRequestSlipFacts({ order, patient, pill }: Props) {
  const tooth = order.teeth[0];
  return (
    <div className="pd-labo-detail">
      <Block
        title={t("Labo:Slip:Info")}
        rows={[
          [t("Labo:Slip:SlipNo"), laboOrderNo(order)],
          [t("Labo:Slip:CaseType"), t(order.caseType === LABO_CASE_TYPE.Redo ? "Labo:Slip:CaseRedo" : "Labo:Slip:CaseNew")],
          [t("Patient:QuoteSheet:PrescribingDoctor"), order.dentistName ?? ""],
          [t("Patient:Col:Customer"), patient.name],
          [t("Patient:Col:DateOfBirth"), formatDate(patient.dateOfBirth)],
        ]}
      />
      <Block
        title={t("Patient:Labo:Info")}
        rows={[
          [t("Patient:Labo:SentDate"), formatDate(order.sentAt)],
          [t("Patient:Labo:ExpectedReceiveDate"), formatDate(order.dueAt)],
        ]}
      />
      <Block
        title={t("Patient:Labo:Params")}
        rows={[
          [t("Patient:Labo:ProsthesisType"), laboWorkOf(order) ?? ""],
          [t("Labo:Slip:Shade"), laboShadeZonesText(tooth?.shadeZones)],
          [t("Labo:Slip:FinishLine"), laboFinishLinesText(order)],
          [t("Labo:Slip:Request"), order.notes ?? ""],
        ]}
      />
      <Block
        title={t("Patient:Stage:SlipDetail")}
        rows={[
          [t("Patient:DentalChart:Tooth"), order.toothNumbers ?? ""],
          [t("Patient:Payment:Quantity"), String(order.quantity)],
        ]}
      >
        <h3>{t("Patient:Misc:StatusLabel")}</h3>
        <StatusPill tone={pill} />
      </Block>
    </div>
  );
}
