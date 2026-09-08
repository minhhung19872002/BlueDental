import { Input } from "antd";
import { FloatingLabel } from "@/components/FloatingLabel";
import { t } from "@/lib/i18n";
import { LaboDeliveryFields } from "./LaboDeliveryFields";
import type { LaboOrderSource } from "./laboOrderSource";
import { LaboSourcePickers, type LaboSourceLists } from "./LaboSourcePickers";
import type { LaboOrderForm } from "./useLaboOrderForm";

interface Props {
  patient: { code: string; name: string };
  source: LaboOrderSource | null;
  lists?: LaboSourceLists;
  /** Handed out by the server; the reference shows it locked. */
  code: string;
  form: LaboOrderForm;
}

/**
 * The top grid of "Đặt mới": the four facts about where the order comes from,
 * then the code, the sent stamp, the supplier and the due stamp. Raised from a
 * công đoạn the four are known and locked; from the tab, the plan, its line
 * and the doctor are picked here and the rest follows from them.
 */
export function LaboNewOrderHeader({ patient, source, lists, code, form }: Props) {
  return (
    <div className="pd-labo-grid">
      <FloatingLabel label={t("Tên khách hàng")} required floated>
        <Input disabled value={`${patient.code} - ${patient.name}`} />
      </FloatingLabel>
      {lists ? (
        <LaboSourcePickers lists={lists} />
      ) : (
        <>
          <FloatingLabel label={t("Kế hoạch điều trị")} required floated>
            <Input disabled value={source?.planLabel ?? ""} />
          </FloatingLabel>
          <FloatingLabel label={t("Dịch vụ điều trị")} required floated>
            <Input disabled value={source?.serviceName ?? ""} />
          </FloatingLabel>
          <FloatingLabel label={t("Bác sĩ chỉ định")} required floated>
            <Input disabled value={source?.dentistName ?? ""} />
          </FloatingLabel>
        </>
      )}

      <FloatingLabel label={t("Số phiếu Labo")} required floated>
        <Input disabled value={code} />
      </FloatingLabel>
      <LaboDeliveryFields
        sentLabels={{ date: t("Ngày gửi"), time: t("Giờ gửi") }}
        suppliers={form.options.suppliers}
      />
    </div>
  );
}
