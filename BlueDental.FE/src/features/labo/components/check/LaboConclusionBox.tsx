import { DatePicker, type FormRule } from "antd";
import type { Dayjs } from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { requiredRule } from "../order-dialogs/useLaboOrderForm";

const DATE_TIME = { showTime: { format: "HH:mm", minuteStep: 5 }, needConfirm: false, format: "DD/MM/YYYY HH:mm" } as const;

/** Hẹn Labo giao lại has to come after the day the work goes back. */
const redeliveryRule: FormRule = ({ getFieldValue }) => ({
  validator: (_, value: Dayjs | undefined) => {
    const returnedAt: Dayjs | undefined = getFieldValue("returnedAt");
    return !value || !returnedAt || value.isAfter(returnedAt)
      ? Promise.resolve()
      : Promise.reject(new Error(t("Labo:Check:RedeliveryAfterReturn")));
  },
});

/**
 * C. Trả hàng cho Labo · lần N, shown once a tooth is Lỗi: only the two dates
 * (P3110 m342) — what is wrong and its pictures sit on each Lỗi tooth in B.
 */
export function LaboConclusionBox({ returnNo }: { returnNo: number }) {
  return (
    <section className="pd-labo-conclusion" aria-label={t("Labo:Check:ConclusionTitle", returnNo)}>
      <header className="pd-labo-check-head">
        <span className="pd-labo-check-badge pd-labo-check-badge--fail">C</span>
        <h3>{t("Labo:Check:ConclusionTitle", returnNo)}</h3>
      </header>
      <div className="pd-labo-check-grid pd-labo-check-grid--two">
        <FloatingField
          name="returnedAt"
          label={t("Labo:Check:ReturnedAt")}
          required
          alwaysFloat
          rules={requiredRule(t("Labo:Check:ReturnedAtRequired"))}
        >
          <DatePicker {...DATE_TIME} className="pd-labo-check-control" />
        </FloatingField>
        <FloatingField
          name="redeliveryDueAt"
          label={t("Labo:Check:RedeliveryDueAt")}
          required
          alwaysFloat
          dependencies={["returnedAt"]}
          rules={[...requiredRule(t("Labo:Check:RedeliveryDueAtRequired")), redeliveryRule]}
        >
          <DatePicker {...DATE_TIME} className="pd-labo-check-control" />
        </FloatingField>
      </div>
    </section>
  );
}
