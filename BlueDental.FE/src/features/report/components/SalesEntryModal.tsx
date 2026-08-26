import { useEffect, useState } from "react";
import { DatePicker, Form, Input, Modal, Select } from "antd";
import { toast } from "sonner";
import dayjs from "dayjs";
import {
  PAYMENT_CHANNEL,
  PAYMENT_CHANNEL_LABELS,
  SALES_ENTRY_TYPE,
  useCashflowCategories,
  useCreateCashflowCategory,
  useCreateSalesEntry,
  useUpdateSalesEntry,
  type PaymentChannel,
  type SalesEntryDto,
  type SalesEntryType,
} from "../api/financeApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { extractApiError } from "@/lib/apiError";
import { CurrencyInput } from "@/components/CurrencyInput";
import { t } from "@/lib/i18n";

interface SalesEntryModalProps {
  open: boolean;
  entry: SalesEntryDto | null;
  /** Only used when creating — an existing voucher keeps its own type. */
  defaultType: SalesEntryType;
  onClose: () => void;
}

interface SalesEntryFormValues {
  type: SalesEntryType;
  categoryId: string;
  amount: number;
  channel: PaymentChannel;
  description: string;
  entryDate: dayjs.Dayjs;
}

const CHANNEL_OPTIONS = Object.entries(PAYMENT_CHANNEL_LABELS).map(([value, label]) => ({
  value: Number(value) as PaymentChannel,
  label,
}));

export function SalesEntryModal({ open, entry, defaultType, onClose }: SalesEntryModalProps) {
  const [form] = Form.useForm<SalesEntryFormValues>();
  const branchId = useCurrentBranchId();
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [newCategoryName, setNewCategoryName] = useState("");

  const createEntry = useCreateSalesEntry();
  const updateEntry = useUpdateSalesEntry();
  const createCategory = useCreateCashflowCategory();

  const { data: categoryPage } = useCashflowCategories(branchId, false);
  const isEdit = entry !== null;
  const type = Form.useWatch("type", form) ?? entry?.type ?? defaultType;

  // Income and expense keep separate category lists, as on the reference.
  const categories = (categoryPage?.items ?? []).filter((c) => c.type === type);

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue({
      type: entry?.type ?? defaultType,
      categoryId: entry?.categoryId ?? undefined,
      amount: entry?.amount ?? undefined,
      channel: entry?.channel ?? PAYMENT_CHANNEL.Cash,
      description: entry?.description ?? "",
      entryDate: dayjs(entry?.entryDate ?? undefined),
    });
  }, [open, entry, defaultType, form]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;

    try {
      const created = await createCategory.mutateAsync({
        clinicBranchId: branchId,
        name,
        type,
        appliesToTransfers: false,
      });
      form.setFieldValue("categoryId", created.id);
      setNewCategoryName("");
      toast.success(t("Đã thêm mục thu chi"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (!currentUserId) {
      toast.error(t("Không xác định được người dùng hiện tại."));
      return;
    }

    const entryDate = values.entryDate.format("YYYY-MM-DD");

    try {
      if (isEdit) {
        await updateEntry.mutateAsync({
          id: entry.id,
          input: {
            categoryId: values.categoryId,
            amount: values.amount,
            channel: values.channel,
            description: values.description,
            entryDate,
          },
        });
        toast.success(t("Đã cập nhật phiếu"));
      } else {
        await createEntry.mutateAsync({
          clinicBranchId: branchId,
          type: values.type,
          categoryId: values.categoryId,
          staffId: currentUserId,
          amount: values.amount,
          channel: values.channel,
          description: values.description,
          entryDate,
        });
        toast.success(
          values.type === SALES_ENTRY_TYPE.Expense
            ? t("Đã tạo phiếu chi — đang chờ duyệt")
            : t("Đã tạo phiếu thu"),
        );
      }

      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t("Sửa phiếu {0}", entry.code) : t("Tạo phiếu thu chi")}
      okText={isEdit ? t("Lưu") : t("Tạo")}
      cancelText={t("Huỷ")}
      confirmLoading={createEntry.isPending || updateEntry.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item name="type" label={t("Loại phiếu")} rules={[{ required: true }]}>
          <Select
            disabled={isEdit}
            options={[
              { value: SALES_ENTRY_TYPE.Income, label: t("Phiếu thu") },
              { value: SALES_ENTRY_TYPE.Expense, label: t("Phiếu chi (cần duyệt)") },
            ]}
            onChange={() => form.setFieldValue("categoryId", undefined)}
          />
        </Form.Item>

        <Form.Item
          name="categoryId"
          label={t("Mục thu chi")}
          rules={[{ required: true, message: t("Vui lòng chọn mục") }]}
        >
          <Select
            placeholder={categories.length === 0 ? t("Chưa có mục — thêm bên dưới") : t("Chọn mục")}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            popupRender={(menu) => (
              <>
                {menu}
                <div style={{ display: "flex", gap: 8, padding: 8 }}>
                  <Input
                    placeholder={t("Thêm mục mới")}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onPressEnter={handleAddCategory}
                  />
                </div>
              </>
            )}
          />
        </Form.Item>

        <Form.Item
          name="amount"
          label={t("Số tiền (đ)")}
          rules={[
            { required: true, message: t("Vui lòng nhập số tiền") },
            { type: "number", min: 1, message: t("Số tiền phải lớn hơn 0") },
          ]}
        >
          <CurrencyInput />
        </Form.Item>

        <Form.Item name="channel" label={t("Hình thức")} rules={[{ required: true }]}>
          <Select options={CHANNEL_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="description"
          label={t("Nội dung")}
          rules={[{ required: true, message: t("Vui lòng nhập nội dung") }]}
        >
          <Input.TextArea rows={2} placeholder={t("Nội dung thu / chi")} />
        </Form.Item>

        <Form.Item name="entryDate" label={t("Ngày")} rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
