import { useEffect } from "react";
import { Form, Input, Select, Switch } from "antd";
import { toast } from "sonner";
import {
  useCreateCallConfiguration,
  useUpdateCallConfiguration,
  type CallConfigurationDto,
} from "../api/toolsApi";
import { CALL_PROVIDERS } from "./callCatalog";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useClinicBranches } from "@/features/organizations/api";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  config: CallConfigurationDto | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
  branchId: string;
  provider: number;
  apiKey: string;
  secretKey: string;
  isActive: boolean;
}

/**
 * The reference's "Cấu hình" dialog: the provider cards on the left, the
 * fields on the right, one save button. "Mã bí mật" is never echoed back by
 * the server, so editing shows it blank — blank on save keeps the stored key.
 */
export function CallConfigDialog({ open, config, onClose }: Props) {
  const currentBranchId = useCurrentBranchId();
  const { data: branches } = useClinicBranches(true);
  const createConfig = useCreateCallConfiguration();
  const updateConfig = useUpdateCallConfiguration();

  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const apiKey = Form.useWatch("apiKey", form) ?? "";
  const secretKey = Form.useWatch("secretKey", form) ?? "";
  const provider = Form.useWatch("provider", form) ?? 0;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      name: config?.name ?? "",
      branchId: config?.branchId ?? currentBranchId,
      provider: config?.provider ?? 0,
      apiKey: config?.apiKey ?? "",
      secretKey: "",
      isActive: config?.isActive ?? true,
    });
  }, [open, config, currentBranchId, form]);

  const pending = createConfig.isPending || updateConfig.isPending;

  const submit = async (values: FormValues) => {
    try {
      if (config) {
        await updateConfig.mutateAsync({
          id: config.id,
          data: {
            name: values.name.trim(),
            provider: values.provider,
            apiKey: values.apiKey.trim(),
            secretKey: values.secretKey.trim() || undefined,
            isActive: values.isActive,
          },
        });
        toast.success(t("Đã cập nhật cấu hình"));
      } else {
        await createConfig.mutateAsync({
          branchId: values.branchId,
          name: values.name.trim(),
          provider: values.provider,
          apiKey: values.apiKey.trim(),
          secretKey: values.secretKey.trim(),
          isActive: values.isActive,
        });
        toast.success(t("Đã tạo cấu hình"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  const canSave =
    name.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    // A new configuration needs its secret; an edit may leave it stored.
    (config !== null || secretKey.trim().length > 0);

  return (
    <AppDialog
      open={open}
      title={t("Cấu hình")}
      width={640}
      canSave={canSave}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ name: "", branchId: "", provider: 0, apiKey: "", secretKey: "", isActive: true }}
        onFinish={(values) => void submit(values)}
      >
        <div className="bd-call-dialog-grid">
          <div>
            {CALL_PROVIDERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={[
                  "bd-call-provider-card",
                  item.value === provider && "bd-call-provider-card--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={item.value === provider}
                onClick={() => form.setFieldValue("provider", item.value)}
              >
                <span className="bd-call-provider-name">{item.label}</span>
                <span className="bd-call-provider-kind">{t("Tổng đài")}</span>
              </button>
            ))}
            <Form.Item name="provider" hidden>
              <Input />
            </Form.Item>
          </div>

          <div className="bd-call-dialog-fields">
            <FloatingField
              name="name"
              label={t("Tên")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập tên") }]}
            >
              <Input autoFocus />
            </FloatingField>

            <FloatingField
              name="branchId"
              label={t("Chi nhánh")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn chi nhánh") }]}
            >
              <Select
                // The update API keeps a configuration in its branch.
                disabled={config !== null}
                options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              />
            </FloatingField>

            <FloatingField
              name="apiKey"
              label={t("Mã khoá")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập mã khoá") }]}
            >
              <Input />
            </FloatingField>

            <FloatingField
              name="secretKey"
              label={t("Mã bí mật")}
              required={config === null}
              // FloatingField owns the placeholder, so the keep-the-stored-key
              // hint rides Form.Item's extra line instead.
              extra={config ? t("Để trống để giữ mã hiện tại") : undefined}
              rules={
                config === null
                  ? [{ required: true, message: t("Vui lòng nhập mã bí mật") }]
                  : undefined
              }
            >
              <Input.Password autoComplete="new-password" />
            </FloatingField>

            <div className="bd-call-dialog-switch">
              <span>{t("Trạng thái")}</span>
              <Form.Item name="isActive" valuePropName="checked">
                <Switch aria-label={t("Trạng thái")} />
              </Form.Item>
            </div>
          </div>
        </div>
      </Form>
    </AppDialog>
  );
}
