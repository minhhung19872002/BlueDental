import { useMemo } from "react";
import { Modal, type TableColumnsType } from "antd";
import { Printer, X } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import type { PatientDto } from "@/features/patient-management/types/patient";
import type { BranchInfo } from "@/hooks/useBranchInfo";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate } from "@/utils/format";
import type { PatientAdviseDto } from "../../api/consultingApi";
import { moneyText } from "../plan/planTypes";
import { dash } from "./planDetailTypes";
import { printSheet } from "./printSheet";
import { ReceiptFacts, ReceiptTotals } from "./ReceiptParts";
import { ReceiptSheet } from "./ReceiptSheet";
import type { ReceiptLine, ReceiptView } from "./receiptView";

interface Props {
  receipt: ReceiptView | null;
  patient: PatientDto;
  /** The letterhead on the printed sheet; undefined while it loads. */
  clinic: BranchInfo | undefined;
  dentistName: string | null;
  /** The advises the slip's lines were written from — the "Chẩn đoán" column. */
  advises: PatientAdviseDto[];
  onClose: () => void;
}

function buildColumns(dentistName: string | null, diagnosisOf: (line: ReceiptLine) => string): TableColumnsType<ReceiptLine> {
  return [
    { key: "service", title: t("Dịch vụ"), width: 180, render: (_, line) => line.service.serviceName ?? line.service.code },
    { key: "diagnosis", title: t("Chẩn đoán"), width: 160, render: (_, line) => diagnosisOf(line) },
    { key: "dentist", title: t("Bác sĩ điều trị"), width: 160, render: () => dash(dentistName) },
    { key: "quantity", title: t("Số lượng"), width: 90, align: "center", render: (_, line) => line.service.quantity },
    { key: "price", title: t("Đơn giá"), width: 140, align: "right", render: (_, line) => moneyText(line.service.price) },
    { key: "discount", title: t("Giảm giá"), width: 140, align: "right", render: (_, line) => moneyText(line.service.discountAmount) },
    { key: "amount", title: t("Thành tiền"), width: 150, align: "right", render: (_, line) => <strong>{moneyText(line.service.effectiveAmount)}</strong> },
  ];
}

/**
 * "Chi tiết phiếu" — the eye on a receipt row and "In hóa đơn tổng" open the
 * same read-out: the receipt, the customer, the services and the money
 * summary, as production lays them out. "In Hoá Đơn" prints not this but the
 * `ReceiptSheet` beside it.
 */
export function PaymentReceiptDialog({ receipt, patient, clinic, dentistName, advises, onClose }: Props) {
  const pagination = useTablePagination(20);
  const lines = receipt?.lines ?? [];
  const pageLines = lines.slice(pagination.skipCount, pagination.skipCount + pagination.pageSize);
  const columns = useMemo(() => {
    const byId = new Map(advises.map((advise) => [advise.id, advise.diagnosisName]));
    return buildColumns(dentistName, (line) =>
      dash(line.service.sourceAdviseId ? byId.get(line.service.sourceAdviseId) : null),
    );
  }, [advises, dentistName]);

  return (
    <Modal
      open={receipt !== null}
      title={t("Chi tiết phiếu")}
      className="tp-dialog pdt-print-dialog"
      width="min(1024px, calc(100vw - 32px))"
      closeIcon={<X size={20} aria-hidden="true" />}
      onCancel={onClose}
      afterClose={pagination.resetToFirstPage}
      footer={
        <div className="pdt-confirm-foot">
          <button type="button" className="tp-btn tp-btn--primary" onClick={printSheet}>
            <Printer size={16} aria-hidden="true" />
            {t("In Hoá Đơn")}
          </button>
        </div>
      }
    >
      {receipt && (
        <ReceiptSheet
          receipt={receipt}
          patient={patient}
          clinic={clinic}
          preparerName={receipt.staffName ?? dentistName}
        />
      )}
      {receipt && (
        <article className="pdt-receipt pdt-screen">
          <div className="pdt-receipt-head">
            <section className="pdt-receipt-section">
              <h3>{t("Chi tiết phiếu")}</h3>
              <ReceiptFacts
                facts={[
                  { label: t("Mã thanh toán"), value: receipt.code },
                  { label: t("Ngày tạo"), value: receipt.createdLabel },
                  { label: t("Phương thức thanh toán"), value: receipt.methodLabel },
                  { label: t("Ghi chú"), value: dash(receipt.note) },
                ]}
              />
            </section>
            <section className="pdt-receipt-section">
              <h3>{t("Thông tin khách hàng")}</h3>
              <ReceiptFacts
                facts={[
                  { label: t("Mã khách hàng"), value: patient.patientCode },
                  { label: t("Khách hàng"), value: patient.fullName },
                  { label: t("Số điện thoại"), value: dash(patient.phoneNumber) },
                  { label: t("Địa chỉ"), value: dash(patient.address) },
                  { label: t("Ngày sinh"), value: patient.dateOfBirth ? formatDate(patient.dateOfBirth) : "—" },
                ]}
              />
            </section>
          </div>

          <section className="pdt-receipt-section">
            <h3>{t("Chi tiết dịch vụ")}</h3>
            <div className="bd-cat-card tp-table pdt-table pdt-receipt-table">
              <DataTable<ReceiptLine>
                rowKey={(line) => line.service.id}
                columns={columns}
                dataSource={pageLines}
                pagination={pagination.buildConfig(lines.length, countedTotal(t("dịch vụ")))}
                locale={{ emptyText: t("Không có dữ liệu") }}
              />
            </div>
          </section>

          <section className="pdt-receipt-section pdt-receipt-sum">
            <h3>{t("Tổng thanh toán dịch vụ")}</h3>
            <ReceiptTotals totals={receipt.totals} />
          </section>
        </article>
      )}
    </Modal>
  );
}
