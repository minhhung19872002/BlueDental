import { Form, Input, message } from "antd";
import { useEffect } from "react";
import { BgColorsOutlined } from "@ant-design/icons";
import { useCreatePatientTag, useUpdatePatientTag, type PatientTagDto } from "../api/patientTagApi";
import { cn } from "@/lib/cn";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

/** The eight swatches the reference offers before the custom colour picker. */
const PRESET_COLORS = [
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#64748B",
] as const;

const DEFAULT_COLOR = "#3B82F6";

interface FormValues {
  name: string;
  color: string;
}

interface Props {
  open: boolean;
  tag: PatientTagDto | null;
  onClose: () => void;
}

export function PatientTagModal({ open, tag, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createTag = useCreatePatientTag();
  const updateTag = useUpdatePatientTag();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const color = Form.useWatch("color", form) ?? DEFAULT_COLOR;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: tag?.name ?? "", color: tag?.color ?? DEFAULT_COLOR });
  }, [open, tag, form]);

  const pending = createTag.isPending || updateTag.isPending;

  const submit = async (values: FormValues) => {
    const trimmed = values.name.trim();

    try {
      if (tag) {
        await updateTag.mutateAsync({
          id: tag.id,
          input: {
            name: trimmed,
            color: values.color,
            description: tag.description ?? undefined,
            isActive: tag.isActive,
          },
        });
        message.success(t("Đã cập nhật thẻ hồ sơ"));
      } else {
        await createTag.mutateAsync({
          clinicBranchId: branchId,
          name: trimmed,
          color: values.color,
        });
        message.success(t("Đã thêm thẻ hồ sơ"));
      }
      onClose();
    } catch (cause) {
      message.error(extractApiError(cause));
    }
  };

  return (
    <AppDialog
      open={open}
      title={tag ? t("Cập nhật thẻ hồ sơ") : t("Thêm thẻ hồ sơ mới")}
      canSave={name.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", color: DEFAULT_COLOR }}
        onFinish={(values) => void submit(values)}
      >
        <FloatingField
          name="name"
          label={t("Tên thẻ hồ sơ")}
          required
          rules={[{ required: true, message: t("Vui lòng nhập tên thẻ hồ sơ") }]}
        >
          <Input autoFocus />
        </FloatingField>

        {/* The colour is picked, not typed, so the field holds it rather than
            rendering a control of its own. */}
        <Form.Item name="color" hidden>
          <Input />
        </Form.Item>

        <div className="bd-dialog-section">
          <p className="bd-dialog-section-title">{t("Màu")}</p>
          <div className="bd-cat-inline">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={t("Chọn màu {0}", preset)}
                aria-pressed={color.toUpperCase() === preset}
                onClick={() => form.setFieldValue("color", preset)}
                style={{ backgroundColor: preset }}
                className={cn(
                  "bd-tag-color",
                  color.toUpperCase() === preset && "bd-tag-color--picked",
                )}
              />
            ))}

            <div className="bd-rel">
              <span aria-hidden="true" className="bd-tag-swatch">
                <BgColorsOutlined />
              </span>
              <input
                type="color"
                aria-label={t("Chọn màu tuỳ chỉnh")}
                value={color}
                onChange={(event) =>
                  form.setFieldValue("color", event.target.value.toUpperCase())
                }
                className="bd-color-input"
              />
            </div>
          </div>
        </div>

        <div className="bd-tag-preview">
          <p className="bd-cat-hint">{t("Xem trước")}</p>
          <span style={{ backgroundColor: color }} className="bd-tag-chip">
            {name.trim() || t("Khách hàng mới")}
          </span>
        </div>
      </Form>
    </AppDialog>
  );
}
