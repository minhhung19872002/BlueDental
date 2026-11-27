import { useState } from "react";
import { Modal } from "antd";
import { Printer, X } from "lucide-react";
import type { PatientAdviseDto } from "@/features/treatment-management/api/consultingApi";
import { t } from "@/lib/i18n";
import { QuoteFacts, QuoteTotalsBlock } from "./QuoteFacts";
import { QuotePreviewModal } from "./QuotePreviewModal";
import { QuoteServiceTable } from "./QuoteServiceTable";
import { QuoteSheet } from "./QuoteSheet";
import { useQuoteSheet } from "./useQuoteSheet";
import "@/features/treatment-management/components/plan/treatment-plan.css";
import "./quote.css";

interface Props {
  open: boolean;
  patientId: string;
  branchId: string;
  /** The rows ticked on the tab showing — Phiếu tư vấn, or a báo giá priced its own way. */
  rows: PatientAdviseDto[];
  voucherDiscount: number;
  onClose: () => void;
}

/**
 * "Chi tiết phiếu" — behind the printer button of Phiếu tư vấn. Branch and
 * customer facts, the ticked services and their total across the full width,
 * and "In Hoá Đơn" at the foot. The image album on the left and "In hóa đơn
 * kèm chẩn đoán" are gone (R-1334).
 */
export function QuoteDetailModal({ open, patientId, branchId, rows, voucherDiscount, onClose }: Props) {
  const sheet = useQuoteSheet({ patientId, branchId, rows, voucherDiscount });
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        className="tp-dialog"
        width="min(1240px, calc(100vw - 32px))"
        closeIcon={<X size={20} />}
        destroyOnHidden
        title={t("Patient:Stage:SlipDetail")}
        footer={
          <div className="pq-footer">
            <button type="button" className="tp-btn tp-btn--primary" onClick={() => setPreviewOpen(true)}>
              <Printer size={16} />
              {t("Patient:MedRecord:PrintInvoice")}
            </button>
          </div>
        }
      >
        <div className="pq-main">
          <QuoteFacts clinic={sheet.clinic} customer={sheet.customer} />
          <QuoteServiceTable rows={sheet.rows} />
          <QuoteTotalsBlock totals={sheet.totals} />
        </div>
      </Modal>

      <QuotePreviewModal
        open={previewOpen}
        subject={t("Patient:Quote:Slip")}
        onClose={() => setPreviewOpen(false)}
      >
        <QuoteSheet clinic={sheet.clinic} customer={sheet.customer} rows={sheet.rows} totals={sheet.totals} />
      </QuotePreviewModal>
    </>
  );
}
