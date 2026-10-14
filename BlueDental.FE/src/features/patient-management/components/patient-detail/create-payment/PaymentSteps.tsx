import { CheckOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  slipChosen: boolean;
  serviceChosen: boolean;
}

const STEP_KEYS = [
  "Patient:Payment:StepSlip",
  "Patient:Payment:StepServices",
  "Patient:Payment:InfoHeader",
] as const;

/** ① Chọn số phiếu → ② Chọn dịch vụ → ③ Thông tin thanh toán; a done step shows ✓. */
export function PaymentSteps({ slipChosen, serviceChosen }: Props) {
  const done = [slipChosen, slipChosen && serviceChosen, false];
  const current = done.indexOf(false);
  return (
    <ol className="pd-newpay-steps">
      {STEP_KEYS.map((key, index) => {
        const state = done[index] ? "done" : index === current ? "current" : "todo";
        return (
          <li key={key} className={`pd-newpay-step pd-newpay-step--${state}`}>
            <span className="pd-newpay-step-dot">{done[index] ? <CheckOutlined /> : index + 1}</span>
            <span className="pd-newpay-step-label">{t(key)}</span>
          </li>
        );
      })}
    </ol>
  );
}
