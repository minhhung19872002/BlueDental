import { useMemo } from "react";
import { Button, Modal } from "antd";
import dayjs from "dayjs";
import { CheckCircleOutlined, FileTextOutlined, InfoCircleOutlined, SaveOutlined } from "@ant-design/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  PAYMENT_ACCOUNT_KIND,
  usePaymentAccountOptions,
  type PaymentAccountKindCode,
} from "@/hooks/usePaymentAccountOptions";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import {
  PAYMENT_METHOD,
  useTreatmentPlans,
  type PatientPaymentDto,
  type PaymentMethodKind,
  type TreatmentPlanSlipDto,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { owingSlipOptions } from "./create-payment/paymentDialogModel";
import { PaymentDateField } from "./create-payment/PaymentDateField";
import { PaymentInfoPanel } from "./create-payment/PaymentInfoPanel";
import { Fact, PaymentSelectedTotals } from "./create-payment/PaymentSelectedTotals";
import { PaymentServiceList } from "./create-payment/PaymentServiceList";
import { PaymentSlipPicker } from "./create-payment/PaymentSlipPicker";
import { PaymentSteps } from "./create-payment/PaymentSteps";
import { usePaymentForm } from "./create-payment/usePaymentForm";
import { useSavePayment } from "./create-payment/useSavePayment";
import "./patient-detail.css";

interface Props {
  open: boolean;
  patientId: string;
  branchId: string;
  /** The slip the dialog was opened from — chosen when it opens; null leaves the choice to the user. */
  plan: TreatmentPlanSlipDto | null;
  /** The row that was clicked — ticked when the dialog opens. */
  focusServiceId: string | null;
  /** Dư nợ — money the clinic already holds for the patient. */
  heldForPatient: number;
  /**
   * A "Chưa thanh toán" receipt reopened from its row: "edit" saves the
   * dialog's figures, "confirm" saves them and settles the receipt (BA
   * 2026-10-08). Left out, the dialog writes a new receipt.
   */
  revision?: PaymentRevision | null;
  onClose: () => void;
  onSaved: () => void;
}

export interface PaymentRevision {
  payment: PatientPaymentDto;
  action: "edit" | "confirm";
}

const TITLE_KEYS = {
  create: "Patient:Payment:CreateTitle",
  edit: "Treatment:Payment:EditPayment",
  confirm: "Treatment:Payment:ConfirmPayment",
} as const;

/**
 * Ngân hàng and Ví momo collect into one of the clinic's accounts, and the
 * reference refuses to save until one is picked. Cash, card and Dư nợ do not.
 */
const ACCOUNT_KIND_BY_METHOD: Partial<Record<PaymentMethodKind, PaymentAccountKindCode>> = {
  [PAYMENT_METHOD.Banking]: PAYMENT_ACCOUNT_KIND.Bank,
  [PAYMENT_METHOD.EWallet]: PAYMENT_ACCOUNT_KIND.MoMo,
};

/**
 * "Tạo phiếu thanh toán": ① the slip, ② its services that still owe money,
 * ③ how much and how. Laid out from the reference's own dialog (1024px, two
 * columns); the slip picker and steps follow the owner's mock (2026-10-12).
 * Every line the money is split across is recorded on one receipt naming it,
 * so the row's Còn nợ moves rather than only the slip's rollup.
 */
export function CreatePaymentDialog({
  open,
  patientId,
  branchId,
  plan,
  focusServiceId,
  heldForPatient,
  revision = null,
  onClose,
  onSaved,
}: Props) {
  const intent = revision?.action ?? "create";
  const plansQuery = useTreatmentPlans(open ? patientId : "", branchId);
  const slips = useMemo(() => plansQuery.data?.items ?? [], [plansQuery.data]);
  const payment = usePaymentForm({
    open,
    initialSlipId: plan?.id ?? null,
    focusServiceId,
    revision: revision?.payment ?? null,
    slips,
    fallbackSlip: plan,
    heldForPatient,
  });
  const slipOptions = useMemo(
    () => owingSlipOptions(slips, payment.form.slipId),
    [slips, payment.form.slipId],
  );

  const accountKind = ACCOUNT_KIND_BY_METHOD[payment.form.method] ?? null;
  const accounts = usePaymentAccountOptions(branchId, accountKind).data ?? [];
  const submit = useSavePayment(payment, {
    patientId,
    branchId,
    intent,
    revision: revision?.payment ?? null,
    needsAccount: accountKind !== null,
    onSaved,
    onClose,
  });

  // A new receipt is dated the day picked; a reopened one keeps the day it was written.
  const paidOn = formatDate(dayjs(payment.form.paidOn).toDate());

  return (
    <Modal
      open={open}
      // 1024px, measured off the reference's own dialog.
      width="min(1024px, calc(100vw - 48px))"
      className="pd-newpay-dialog"
      title={t(TITLE_KEYS[intent])}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className="pd-newpay-footer">
          <p>
            <InfoCircleOutlined />{" "}
            {/* A new receipt is "Hoàn tất" at once, and a Hoàn tất one is final. */}
            {t(revision ? "Patient:Payment:EditWarning" : "Patient:Payment:FinalWarning")}
          </p>
          <Button
            type="primary"
            icon={intent === "confirm" ? <CheckCircleOutlined /> : <SaveOutlined />}
            loading={submit.pending}
            disabled={submit.pending}
            onClick={submit.request}
          >
            {intent === "confirm" ? t("Treatment:Payment:ConfirmPayment") : t("Common:Save")}
          </Button>
        </div>
      }
    >
      <PaymentSteps slipChosen={payment.slip !== null} serviceChosen={payment.chosen.length > 0} />
      <div className="pd-newpay-grid">
        <div className="pd-newpay-col">
          <section>
            <h4 className="pd-newpay-head">
              <FileTextOutlined /> {t("Patient:Payment:SummaryHeader")}
            </h4>
            <Fact label={t("Patient:Payment:Description")} value={t("Patient:Payment:DefaultDescription", paidOn)} />
            {revision ? (
              <Fact label={t("Patient:Payment:DateLabel")} value={paidOn} />
            ) : (
              <PaymentDateField value={payment.form.paidOn} onChange={(day) => payment.update({ paidOn: day })} />
            )}
          </section>

          <section>
            <h4 className="pd-newpay-head">
              <FileTextOutlined /> {t("Patient:Payment:SlipHeader")}
              <span className="pd-newpay-required">*</span>
            </h4>
            <PaymentSlipPicker
              options={slipOptions}
              value={payment.form.slipId}
              loading={plansQuery.isLoading}
              locked={revision !== null}
              onChange={payment.chooseSlip}
            />
          </section>

          <PaymentServiceList
            slipCode={payment.slip?.code ?? null}
            lines={payment.lines}
            picked={payment.form.picked}
            onToggle={payment.toggle}
            onToggleAll={payment.toggleAll}
          />

          <PaymentSelectedTotals totals={payment.totals} />
        </div>

        <PaymentInfoPanel
          payment={payment}
          heldForPatient={heldForPatient}
          accountKind={accountKind}
          accounts={accounts}
        />
      </div>
      <ConfirmDialog
        open={submit.confirming}
        title={t("Treatment:Payment:ConfirmPayment")}
        message={t("Patient:Payment:ConfirmCreate", formatMoneyUnit(payment.total))}
        pending={submit.pending}
        onConfirm={() => void submit.commit()}
        onClose={submit.cancel}
      />
    </Modal>
  );
}
