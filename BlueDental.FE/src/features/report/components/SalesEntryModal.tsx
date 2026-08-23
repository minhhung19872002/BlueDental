import { useEffect, useState } from "react";
import { DatePicker, Form, Input, InputNumber, Modal, Select, message } from "antd";
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
      message.success("Đã thêm mục thu chi");
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    if (!currentUserId) {
      message.error("Không xác định được người dùng hiện tại.");
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
        message.success("Đã cập nhật phiếu");
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
        message.success(
          values.type === SALES_ENTRY_TYPE.Expense
            ? "Đã tạo phiếu chi — đang chờ duyệt"
            : "Đã tạo phiếu thu",
        );
      }

      onClose();
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? `Sửa phiếu ${entry.code}` : "Tạo phiếu thu chi"}
      okText={isEdit ? "Lưu" : "Tạo"}
      cancelText="Huỷ"
      confirmLoading={createEntry.isPending || updateEntry.isPending}
      onOk={handleSubmit}
      onCancel={onClose}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item name="type" label="Loại phiếu" rules={[{ required: true }]}>
          <Select
            disabled={isEdit}
            options={[
              { value: SALES_ENTRY_TYPE.Income, label: "Phiếu thu" },
              { value: SALES_ENTRY_TYPE.Expense, label: "Phiếu chi (cần duyệt)" },
            ]}
            onChange={() => form.setFieldValue("categoryId", undefined)}
          />
        </Form.Item>

        <Form.Item
          name="categoryId"
          label="Mục thu chi"
          rules={[{ required: true, message: "Vui lòng chọn mục" }]}
        >
          <Select
            placeholder={categories.length === 0 ? "Chưa có mục — thêm bên dưới" : "Chọn mục"}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            popupRender={(menu) => (
              <>
                {menu}
                <div style={{ display: "flex", gap: 8, padding: 8 }}>
                  <Input
                    placeholder="Thêm mục mới"
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
          label="Số tiền (đ)"
          rules={[
            { required: true, message: "Vui lòng nhập số tiền" },
            { type: "number", min: 1, message: "Số tiền phải lớn hơn 0" },
          ]}
        >
          <InputNumber<number>
            style={{ width: "100%" }}
            min={0}
            step={10000}
            formatter={(v) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
            parser={(v) => Number((v ?? "").replace(/\./g, ""))}
          />
        </Form.Item>

        <Form.Item name="channel" label="Hình thức" rules={[{ required: true }]}>
          <Select options={CHANNEL_OPTIONS} />
        </Form.Item>

        <Form.Item
          name="description"
          label="Nội dung"
          rules={[{ required: true, message: "Vui lòng nhập nội dung" }]}
        >
          <Input.TextArea rows={2} placeholder="Nội dung thu / chi" />
        </Form.Item>

        <Form.Item name="entryDate" label="Ngày" rules={[{ required: true }]}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
