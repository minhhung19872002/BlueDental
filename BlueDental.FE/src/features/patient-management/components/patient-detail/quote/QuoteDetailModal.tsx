import { useEffect, useState } from "react";
import { Modal } from "antd";
import { Printer, ReceiptText, X } from "lucide-react";
import type {
  PatientAdviseDto,
  PatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";
import { t } from "@/lib/i18n";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";
import { DiagnosisInvoiceSheet } from "./DiagnosisInvoiceSheet";
import { QuoteFacts, QuoteTotalsBlock } from "./QuoteFacts";
import { QuoteImageAside } from "./QuoteImageAside";
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
  /** The advise rows ticked on Phiếu tư vấn. */
  rows: PatientAdviseDto[];
  diagnoses: PatientDiagnosisDto[];
  images: PatientImageViewModel[];
  voucherDiscount: number;
  onClose: () => void;
}

type Preview = "quote" | "diagnosis" | null;

/**
 * "Chi tiết phiếu" — behind the printer button of Phiếu tư vấn. Branch and
 * customer facts, the ticked services and their total, the album on the
 * left to pick which images print, and the two previews at the foot.
 */
export function QuoteDetailModal({
  open,
  patientId,
  branchId,
  rows,
  diagnoses,
  images,
  voucherDiscount,
  onClose,
}: Props) {
  const sheet = useQuoteSheet({ patientId, branchId, rows, diagnoses, images, voucherDiscount });
  const [printing, setPrinting] = useState<Set<string>>(() => new Set());
  const [preview, setPreview] = useState<Preview>(null);

  // Every open starts with no image ticked, as the reference does.
  useEffect(() => {
    if (open) setPrinting(new Set());
  }, [open]);

  const printedImages = sheet.images.filter((image) => printing.has(image.id));

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        className="tp-dialog"
        width="min(1240px, calc(100vw - 32px))"
        closeIcon={<X size={20} />}
        destroyOnHidden
        title={t("Chi tiết phiếu")}
        footer={
          <div className="pq-footer">
            <button
              type="button"
              className="tp-btn tp-btn--outline"
              onClick={() => setPreview("diagnosis")}
            >
              <ReceiptText size={16} />
              {t("In hóa đơn kèm chẩn đoán")}
            </button>
            <button
              type="button"
              className="tp-btn tp-btn--primary"
              onClick={() => setPreview("quote")}
            >
              <Printer size={16} />
              {t("In Hoá Đơn")}
            </button>
          </div>
        }
      >
        <div className="pq-body">
          <QuoteImageAside
            images={sheet.images}
            printing={printing}
            onPrintingChange={setPrinting}
          />
          <div className="pq-main">
            <QuoteFacts clinic={sheet.clinic} customer={sheet.customer} />
            <QuoteServiceTable rows={sheet.rows} />
            <QuoteTotalsBlock totals={sheet.totals} />
          </div>
        </div>
      </Modal>

      <QuotePreviewModal
        open={preview === "quote"}
        subject={t("Phiếu Báo Giá")}
        onClose={() => setPreview(null)}
      >
        <QuoteSheet
          clinic={sheet.clinic}
          customer={sheet.customer}
          rows={sheet.rows}
          totals={sheet.totals}
        />
      </QuotePreviewModal>

      <QuotePreviewModal
        open={preview === "diagnosis"}
        subject={t("Hóa Đơn Kèm Chẩn Đoán")}
        onClose={() => setPreview(null)}
      >
        <DiagnosisInvoiceSheet
          clinic={sheet.clinic}
          customer={sheet.customer}
          rows={sheet.rows}
          totals={sheet.totals}
          images={printedImages}
        />
      </QuotePreviewModal>
    </>
  );
}
