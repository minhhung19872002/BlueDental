import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, ConfigProvider, Form, Modal, Tabs } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { voucherDialogTheme } from "@/theme";
import {
  useCreateVoucher,
  useCreateVoucherBatch,
  useVoucherCodePrefix,
  type CreateVoucherInput,
  type CreateVoucherBatchInput,
  type VoucherBatchItemInput,
} from "../api/voucherApi";
import {
  VOUCHER_FORM_DEFAULTS,
  type VoucherBatchItemValues,
  type VoucherFormValues,
} from "../types/voucherForm";
import { useVoucherBatch, type BatchVoucherItem } from "../hooks/useVoucherBatch";
import { VoucherFormFields } from "./VoucherFormFields";
import { VoucherSingleTab } from "./VoucherSingleTab";
import { VoucherBatchTab } from "./VoucherBatchTab";

interface Props {
  open: boolean;
  onClose: () => void;
}

function sharedFields(v: VoucherBatchItemValues) {
  return {
    description: v.description || undefined,
    discountType: v.discountType,
    discountValue: v.discountValue,
    maxDiscountAmount: v.maxDiscountAmount ?? null,
    scopeTarget: v.scopeTarget,
    targetIds: v.targetIds ?? [],
    minOrderValue: v.minOrderValue ?? null,
    startDate: v.startDate.toISOString(),
    endDate: v.endDate.toISOString(),
    usageLimit: v.usageLimit ?? null,
    perCustomerLimit: v.perCustomerLimit ?? null,
    isExclusive: v.isExclusive ?? false,
    customerTargets: v.customerTargets ?? ["new", "returning"],
    isDaysOfWeekLimited: v.isDaysOfWeekLimited ?? false,
    daysOfWeek: v.daysOfWeek ?? [],
    displayOnNfcDental: v.displayOnNfcDental ?? true,
  };
}

function toBatchItem(item: BatchVoucherItem, configAll: boolean): VoucherBatchItemInput {
  // With "Cấu hình tất cả" the item carries only code+name and the server
  // falls back to the batch-level fields; otherwise it is fully configured.
  return configAll
    ? { code: item.code || undefined, name: item.name.trim() }
    : { code: item.code || undefined, name: item.name.trim(), ...sharedFields(item.values) };
}

function missingNameIndices(items: BatchVoucherItem[]): number[] {
  return items.map((it, i) => (it.name.trim() ? -1 : i)).filter((i) => i >= 0);
}

/** First problem among the batch items besides missing names, or null. */
function findBatchProblem(
  items: BatchVoucherItem[],
  configAll: boolean,
  prefixLabel: string,
): string | null {
  const codes = items.map((it) => it.code).filter(Boolean);
  const dup = codes.find((c, i) => codes.indexOf(c) !== i);
  if (dup) {
    return t("Mã {0} bị trùng trong danh sách", `${prefixLabel}${dup}`);
  }
  if (!configAll) {
    const noLimit = items.findIndex((it) => it.values.usageLimit == null);
    if (noLimit >= 0) {
      return t("Vui lòng nhập số lượt tối đa cho mã #{0}", noLimit + 1);
    }
  }
  return null;
}

export function VoucherCreateDialog({ open, onClose }: Props) {
  const [form] = Form.useForm<VoucherFormValues>();
  const [tab, setTab] = useState<"single" | "batch">("single");

  const branchId = useCurrentBranchId();
  const createVoucher = useCreateVoucher();
  const createBatch = useCreateVoucherBatch();
  const isPending = createVoucher.isPending || createBatch.isPending;

  // Codes are generated client-side; only the prefix is server-owned. Stamp
  // it into the form whenever the dialog opens — resetFields clears it, and
  // the query result stays cached across reopens.
  const codePrefix = useVoucherCodePrefix(open);
  useEffect(() => {
    if (open && codePrefix.data) {
      form.setFieldsValue({ prefix: codePrefix.data.prefix });
    }
  }, [open, codePrefix.data, form]);

  const batch = useVoucherBatch(form);

  const prefix = Form.useWatch("prefix", form) ?? "";
  const prefixLabel = `${prefix || "HN"}-`;

  const resetAll = useCallback(() => {
    form.resetFields();
    batch.reset();
    setTab("single");
  }, [form, batch]);

  const handleTabChange = useCallback(
    (key: string) => {
      setTab(key as "single" | "batch");
      if (key === "batch") {
        batch.activate(form.getFieldValue("code") as string | undefined);
      }
    },
    [batch, form],
  );

  const handleSubmit = useCallback(async () => {
    // Snapshot batch names before form validation so empty-name cards turn
    // red together with the antd field errors instead of only afterwards.
    let items: BatchVoucherItem[] = [];
    let missing: number[] = [];
    if (tab === "batch") {
      items = batch.finalize();
      missing = missingNameIndices(items);
      batch.markNameErrors(missing);
    }

    let values: VoucherFormValues;
    try {
      values = await form.validateFields();
    } catch {
      if (missing.length > 0) toast.error(t("Vui lòng nhập tên cho tất cả voucher"));
      return;
    }
    if (missing.length > 0) {
      toast.error(t("Vui lòng nhập tên cho tất cả voucher"));
      return;
    }

    // No Form.Item registers "prefix" (it only shows as the code addon), so
    // validateFields() omits it — read it off the form store directly.
    const prefixValue = (form.getFieldValue("prefix") as string | undefined) || undefined;

    try {
      if (tab === "single") {
        const input: CreateVoucherInput = {
          ...sharedFields(values),
          prefix: prefixValue,
          code: values.code || undefined,
          name: values.name,
          branchId,
        };
        await createVoucher.mutateAsync(input);
        toast.success(t("Đã tạo voucher"));
      } else {
        const problem = findBatchProblem(items, batch.configAll, prefixLabel);
        if (problem) {
          toast.error(problem);
          return;
        }
        const input: CreateVoucherBatchInput = {
          ...sharedFields(values),
          prefix: prefixValue,
          count: items.length,
          configureAll: batch.configAll,
          items: items.map((it) => toBatchItem(it, batch.configAll)),
          branchId,
        };
        await createBatch.mutateAsync(input);
        toast.success(t("Đã tạo {0} voucher", items.length));
      }
      resetAll();
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  }, [form, tab, batch, branchId, createVoucher, createBatch, prefixLabel, resetAll, onClose]);

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [resetAll, onClose]);

  return (
    <ConfigProvider theme={voucherDialogTheme}>
      <Modal
        open={open}
        title={<h2 className="bd-modal-title">{t("Tạo voucher khuyến mãi")}</h2>}
        onCancel={handleClose}
        width={780}
        destroyOnHidden
        className="app-dialog voucher-dialog"
        footer={
          <div className="voucher-dialog-footer">
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={isPending}
              disabled={isPending}
              onClick={handleSubmit}
            >
              {t("Tạo voucher")}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark
          initialValues={VOUCHER_FORM_DEFAULTS}
        >
          <Tabs
            activeKey={tab}
            onChange={handleTabChange}
            items={[
              {
                key: "single",
                label: t("Tạo theo số lượng"),
                destroyOnHidden: true,
                children: <VoucherSingleTab form={form} />,
              },
              {
                key: "batch",
                label: t("Tạo một lượt"),
                destroyOnHidden: true,
                children: <VoucherBatchTab batch={batch} prefixLabel={prefixLabel} />,
              },
            ]}
          />

          <VoucherFormFields form={form} />
        </Form>
      </Modal>
    </ConfigProvider>
  );
}
