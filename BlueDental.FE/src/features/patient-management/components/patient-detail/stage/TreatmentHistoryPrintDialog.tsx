import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button, Modal } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatShortDate } from "@/utils/format";
import { formatTeeth } from "@/features/treatment-management/api/consultingApi";
import type { TreatmentStageDto } from "@/features/treatment-management/api/stageApi";
import type { TreatmentServiceStatus } from "@/features/treatment-management/api/treatmentPlanApi";
import { stageRowStatus, stageRowStatusLabel } from "../stageRowStatus";

export interface PrintClinic {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface PrintPatient {
  code: string;
  name: string;
}

interface Props {
  open: boolean;
  clinic: PrintClinic;
  patient: PrintPatient;
  stages: TreatmentStageDto[];
  /** A line's own status, so the row can print the chip beside its date. */
  statusOf: (treatmentServiceId: string) => TreatmentServiceStatus | null;
  onClose: () => void;
}

/** "Ngày 6 tháng 9 năm 2026", the wording on the reference's printed sheet. */
function longDate(value: Date): string {
  return t(
    "Ngày {0} tháng {1} năm {2}",
    value.getDate(),
    value.getMonth() + 1,
    value.getFullYear(),
  );
}

function Rows({ stages, statusOf }: Pick<Props, "stages" | "statusOf">) {
  return (
    <tbody>
      {stages.map((stage) => {
        const status = stageRowStatus(
          statusOf(stage.treatmentServiceId),
          stage.completedAt !== null,
        );
        return (
          <tr key={stage.id}>
            <td>
              <p className="pd-print-teeth">{formatTeeth(stage.teeth)}</p>
              <p>{stage.serviceName ?? stage.name}</p>
            </td>
            <td>
              <p>{formatShortDate(stage.creationTime)}</p>
              <div className={`pd-print-chip pd-print-chip--${status}`}>
                {stageRowStatusLabel(status)}
              </div>
            </td>
            <td className="pd-print-note">{stage.note ?? ""}</td>
            <td>{stage.staffName ?? t("(Trống)")}</td>
            <td>{stage.subStaffName ?? t("(Trống)")}</td>
            <td>{stage.secondStaffName ?? t("(Trống)")}</td>
          </tr>
        );
      })}
    </tbody>
  );
}

function Head() {
  return (
    <thead>
      <tr>
        <th>{t("Dịch vụ")}</th>
        <th>{t("Ngày điều trị")}</th>
        <th>{t("Nội dung điều trị")}</th>
        <th>{t("Bác sĩ")}</th>
        <th>{t("Phụ tá")}</th>
        <th>{t("Bác sĩ hỗ trợ")}</th>
      </tr>
    </thead>
  );
}

/**
 * "In lịch sử điều trị" — the second dialog behind the stage dialog's printer
 * button.
 *
 * On screen it is a plain read-out; the A4 sheet that actually reaches the
 * printer is a second copy kept off-screen, carrying the centred title, the
 * long-form date and the two signature blocks the reference prints. Measured
 * from the reference on 2026-09-06 — see docs/clone/pages/patient-detail.md.
 */
export function TreatmentHistoryPrintDialog({
  open,
  clinic,
  patient,
  stages,
  statusOf,
  onClose,
}: Props) {
  // The class is dropped when the browser is finished, not on the next line:
  // window.print() does not reliably block until the preview closes, and
  // removing it too early puts the page back before anything is rendered.
  useEffect(() => {
    const done = () => document.body.classList.remove("pd-printing");
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  const handlePrint = () => {
    // Only the sheet reaches the printer: the body carries a print rule that
    // hides its other children while this class is on it.
    document.body.classList.add("pd-printing");
    window.print();
  };

  const today = new Date();

  /*
   * The A4 copy lives in a portal on document.body, not inside the modal.
   * AntD renders the modal into a portal wrapper of its own, and the print rule
   * that hides the body's other children hides that wrapper too — a descendant
   * cannot un-hide itself, which is why printing from inside the modal produced
   * a blank preview.
   */
  const sheet = createPortal(
    <div className="pd-print-sheet">
      <article>
        <div className="pd-print-sheethead">
          <section>
            <p>
              <span>{t("Phòng khám")}:</span> <span>{clinic.name}</span>
            </p>
            <p>
              <span>{t("Địa chỉ")}:</span> <span>{clinic.address ?? "—"}</span>
            </p>
            <p>
              <span>{t("ĐT")}:</span> <span>{clinic.phone ?? "—"}</span>
            </p>
            <p>
              <span>{t("Email")}:</span> <span>{clinic.email ?? "—"}</span>
            </p>
          </section>
          <header>
            <h2>{t("Chi tiết phiếu")}</h2>
            <p>{longDate(today)}</p>
          </header>
          <section>
            <p>
              <span>{t("Mã KH")}:</span> <span>{patient.code}</span>
            </p>
            <p>
              <span>{t("Họ và tên")}:</span> <span>{patient.name}</span>
            </p>
          </section>
        </div>

        <table className="pd-print-table">
          <Head />
          <Rows stages={stages} statusOf={statusOf} />
        </table>

        <div className="pd-print-signs">
          <div>
            <p>{t("Người lập phiếu")}</p>
            <p>{t("(Ký, họ tên)")}</p>
            <p>{stages[0]?.staffName ?? ""}</p>
          </div>
          <div>
            <p>{t("Khách hàng")}</p>
            <p>{t("(Ký, họ tên)")}</p>
            <p>{patient.name}</p>
          </div>
        </div>
      </article>
    </div>,
    document.body,
  );

  return (
    <Modal
      open={open}
      width={1024}
      className="pd-print-dialog"
      title={t("Chi tiết phiếu")}
      onCancel={onClose}
      footer={
        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          {t("In Phiếu")}
        </Button>
      }
      destroyOnHidden
    >
      <div className="pd-print-body">
        <div className="pd-print-facts">
          <section>
            <h3>{t("Thông tin chi nhánh")}</h3>
            <p>
              <span>{t("Phòng khám")}:</span> <span>{clinic.name}</span>
            </p>
            <p>
              <span>{t("Địa chỉ")}:</span> <span>{clinic.address ?? "—"}</span>
            </p>
            <p>
              <span>{t("ĐT")}:</span> <span>{clinic.phone ?? "—"}</span>
            </p>
            <p>
              <span>{t("Email")}:</span> <span>{clinic.email ?? "—"}</span>
            </p>
          </section>
          <section>
            <h3>{t("Thông tin khách hàng")}</h3>
            <p>
              <span>{t("Mã KH")}:</span> <span className="pd-print-code">{patient.code}</span>
            </p>
            <p>
              <span>{t("Họ và tên")}:</span> <span>{patient.name}</span>
            </p>
          </section>
        </div>

        <table className="pd-print-table">
          <Head />
          <Rows stages={stages} statusOf={statusOf} />
        </table>
      </div>

      {sheet}
    </Modal>
  );
}
