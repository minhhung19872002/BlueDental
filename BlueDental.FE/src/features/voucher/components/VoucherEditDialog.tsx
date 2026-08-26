import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { ConfigProvider, Form } from "antd";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { AppDialog } from "@/components/AppDialog";
import { voucherDialogTheme } from "@/theme";
import {
  useUpdateVoucher,
  useVoucherCodePrefix,
  type VoucherDto,
  type UpdateVoucherInput,
} from "../api/voucherApi";
import { VOUCHER_FORM_DEFAULTS, type VoucherFormValues } from "../types/voucherForm";
import { VoucherFormFields } from "./VoucherFormFields";
import { VoucherSingleTab } from "./VoucherSingleTab";

interface Props {
  voucher: VoucherDto | null;
  onClose: () => void;
}

/**
 * The ref edits a voucher with the same form the single-voucher create tab
 * uses — every field stays editable, including the code and the discount.
 */
export function VoucherEditDialog({ voucher, onClose }: Props) {
  const [form] = Form.useForm<VoucherFormValues>();
  const updateVoucher = useUpdateVoucher();

  // A voucher created before prefixes were joined in has none stored; adopt
  // the server's current prefix so saving heals its code.
  const codePrefix = useVoucherCodePrefix(voucher !== null && !voucher.prefix);

  // VoucherSingleTab generates a code on mount when the field is empty; its
  // child effect runs before this one, so the voucher's own values win.
  useEffect(() => {
    // Reset on close too, so reopening the same voucher never shows the
    // abandoned edits of the previous visit.
    form.resetFields();
    if (!voucher) return;

    // The stored code is the full "HN-XXXXXXXX"; the dialog shows the prefix
    // as an addon and edits only the bare part, so split it back off.
    const prefix = voucher.prefix ?? "";
    const bareCode = prefix && voucher.code.startsWith(`${prefix}-`)
      ? voucher.code.slice(prefix.length + 1)
      : voucher.code;

    form.setFieldsValue({
      prefix,
      code: bareCode,
      name: voucher.name,
      description: voucher.description ?? "",
      discountType: voucher.discountType,
      discountValue: voucher.discountValue,
      maxDiscountAmount: voucher.maxDiscountAmount,
      scopeTarget: voucher.scopeTarget,
      targetIds: voucher.targetIds ?? [],
      minOrderValue: voucher.minOrderValue,
      startDate: dayjs(voucher.startDate),
      endDate: dayjs(voucher.endDate),
      usageLimit: voucher.usageLimit,
      perCustomerLimit: voucher.perCustomerLimit,
      isExclusive: voucher.isExclusive,
      customerTargets: voucher.customerTargets ?? ["new", "returning"],
      isDaysOfWeekLimited: voucher.isDaysOfWeekLimited,
      daysOfWeek: voucher.daysOfWeek ?? [],
      displayOnNfcDental: voucher.displayOnNfcDental,
    });
  }, [voucher, form]);

  // Stamped separately so a late prefix fetch never repopulates the whole
  // form over the user's in-progress edits.
  useEffect(() => {
    if (voucher && !voucher.prefix && codePrefix.data) {
      form.setFieldsValue({ prefix: codePrefix.data.prefix });
    }
  }, [voucher, codePrefix.data, form]);

  const handleSave = useCallback(async () => {
    if (!voucher) return;

    let values: VoucherFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    // "prefix" has no registered Form.Item (it only shows as the code
    // addon), so validateFields() omits it — read the form store directly.
    const prefixValue = (form.getFieldValue("prefix") as string | undefined) || undefined;

    const input: UpdateVoucherInput = {
      code: values.code || undefined,
      prefix: prefixValue,
      name: values.name,
      description: values.description || undefined,
      discountType: values.discountType,
      discountValue: values.discountValue,
      scopeTarget: values.scopeTarget,
      targetIds: values.targetIds ?? [],
      minOrderValue: values.minOrderValue ?? null,
      maxDiscountAmount: values.maxDiscountAmount ?? null,
      isExclusive: values.isExclusive ?? false,
      customerTargets: values.customerTargets ?? ["new", "returning"],
      perCustomerLimit: values.perCustomerLimit ?? null,
      isDaysOfWeekLimited: values.isDaysOfWeekLimited ?? false,
      daysOfWeek: values.daysOfWeek ?? [],
      displayOnNfcDental: values.displayOnNfcDental ?? true,
      startDate: values.startDate.toISOString(),
      endDate: values.endDate.toISOString(),
      usageLimit: values.usageLimit ?? null,
    };

    try {
      await updateVoucher.mutateAsync({ id: voucher.id, input });
      toast.success(t("Đã cập nhật voucher"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  }, [voucher, form, updateVoucher, onClose]);

  return (
    <ConfigProvider theme={voucherDialogTheme}>
      <AppDialog
        open={voucher !== null}
        title={t("Chỉnh sửa voucher")}
        width={780}
        className="voucher-dialog voucher-dialog--edit"
        canSave={!updateVoucher.isPending}
        saving={updateVoucher.isPending}
        saveLabel={t("Lưu thay đổi")}
        onSave={handleSave}
        onClose={onClose}
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={VOUCHER_FORM_DEFAULTS}
        >
          <VoucherSingleTab form={form} />
          <VoucherFormFields form={form} />
        </Form>
      </AppDialog>
    </ConfigProvider>
  );
}
