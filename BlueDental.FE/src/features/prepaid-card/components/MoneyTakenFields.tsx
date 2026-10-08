import { Form, Radio, Select } from "antd";
import { PAYMENT_ACCOUNT_KIND, usePaymentAccountOptions, type PaymentAccountKindCode } from "@/hooks/usePaymentAccountOptions";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { SALE_METHOD, type SaleMethod } from "../types";

const METHOD_LABEL_KEYS: Record<SaleMethod, string> = {
  [SALE_METHOD.Cash]: "Treatment:Payment:Cash",
  [SALE_METHOD.Banking]: "Treatment:Payment:Banking",
  [SALE_METHOD.Card]: "Treatment:Payment:Card",
  [SALE_METHOD.EWallet]: "Treatment:Payment:EWallet",
};

const ACCOUNT_KIND: Partial<Record<SaleMethod, PaymentAccountKindCode>> = {
  [SALE_METHOD.Banking]: PAYMENT_ACCOUNT_KIND.Bank,
  [SALE_METHOD.EWallet]: PAYMENT_ACCOUNT_KIND.MoMo,
};

/**
 * "Hình thức thu" for a card sale or a top-up: the money is taken like a
 * receipt's, and Ngân hàng / Ví momo name the clinic account it went into.
 * Lives inside a Form with fields `method` and `paymentAccountId`.
 */
export function MoneyTakenFields() {
  const branchId = useCurrentBranchId();
  const method = Form.useWatch<SaleMethod | undefined>("method");
  const accountKind = (method && ACCOUNT_KIND[method]) ?? null;
  const { data: accounts = [], isLoading } = usePaymentAccountOptions(branchId, accountKind);

  return (
    <>
      <Form.Item name="method" label={t("PrepaidCard:Field:Method")} rules={[{ required: true }]}>
        <Radio.Group
          optionType="button"
          options={Object.values(SALE_METHOD).map((value) => ({ value, label: t(METHOD_LABEL_KEYS[value]) }))}
        />
      </Form.Item>
      {accountKind !== null ? (
        <Form.Item
          name="paymentAccountId"
          label={t("PrepaidCard:Field:Account")}
          rules={[{ required: true, message: t("PrepaidCard:Validation:Account") }]}
        >
          <Select
            loading={isLoading}
            placeholder={t("PrepaidCard:Field:Account")}
            notFoundContent={t("Common:NoData")}
            options={accounts.map((account) => ({
              value: account.id,
              label:
                accountKind === PAYMENT_ACCOUNT_KIND.Bank
                  ? `${account.bankName ?? "—"} · ${account.accountNumber ?? "—"}`
                  : `${account.phoneNumber ?? "—"} · ${account.holderName}`,
            }))}
          />
        </Form.Item>
      ) : null}
    </>
  );
}
