import { useEffect } from "react";
import { Form, Input } from "antd";
import { toast } from "sonner";
import { useLaboCatalogCommands, type LaboCatalogItem } from "../api/laboCatalogListApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  group: string;
  /** Lowercase noun of the catalog, e.g. "khớp cắn". */
  noun: string;
  /** The row being renamed, or null while creating. */
  item: LaboCatalogItem | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
}

/**
 * The form Khớp cắn, Đường hoàn tất and Kiểu nhịp share on the reference: one
 * name and nothing else, capped at 100 characters, with the save disabled
 * until something is typed.
 *
 * Its wording is built from the catalog's noun the way the reference builds
 * it — "Tạo khớp cắn" / "Sửa khớp cắn" over a "Tên khớp cắn" field.
 */
export function LaboCatalogDialog({ open, group, noun, item, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const { create, update } = useLaboCatalogCommands(group);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: item?.name ?? "" });
  }, [open, item, form]);

  const pending = create.isPending || update.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();

    try {
      if (item) {
        // The row's own priority goes back untouched, so a rename never
        // reorders the list.
        await update.mutateAsync({ id: item.id, name: trimmed, sortOrder: item.sortOrder });
        toast.success(t("Đã cập nhật"));
      } else {
        await create.mutateAsync({ name: trimmed });
        toast.success(t("Đã thêm"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      width={460}
      title={item ? t("Sửa {0}", noun) : t("Tạo {0}", noun)}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "" }}
        onFinish={(values) => void submit(values)}
      >
        <FloatingField
          name="name"
          label={t("Tên {0}", noun)}
          required
          rules={[{ required: true, message: t("Vui lòng nhập tên {0}", noun) }]}
        >
          <Input autoFocus maxLength={100} />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
