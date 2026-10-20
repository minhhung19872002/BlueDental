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
        toast.success(t("Tools:ConfigUpdated"));
      } else {
        await createConfig.mutateAsync({
          branchId: values.branchId,
          name: values.name.trim(),
          provider: values.provider,
          apiKey: values.apiKey.trim(),
          secretKey: values.secretKey.trim(),
          isActive: values.isActive,
        });
        toast.success(t("Tools:ConfigCreated"));
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
      title={t("Tools:ConfigDialogTitle")}
      width={772}
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
        <div className="bd-inv-dialog-grid">
          <div>
            <div className="bd-msg-provider-label">{t("Tools:ProviderLabel")}</div>
            {CALL_PROVIDERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={[
                  "bd-msg-provider-card",
                  item.value === provider && "bd-msg-provider-card--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-pressed={item.value === provider}
                onClick={() => form.setFieldValue("provider", item.value)}
              >
                <span className="bd-msg-provider-img">
                  {/* UNKNOWN_REFERENCE_BEHAVIOR: exact Voip24h logo asset URL
                      could not be safely extracted. Using inline SVG text
                      placeholder until a proper logo is sourced. */}
                  <svg viewBox="0 0 100 40" width="100" height="40" aria-label={item.label}>
                    <text
                      x="50%"
                      y="50%"
                      dominantBaseline="central"
                      textAnchor="middle"
                      fill="#6366f1"
                      fontFamily="Arial, sans-serif"
                      fontWeight="700"
                      fontSize="18"
                    >
                      {item.label}
                    </text>
                  </svg>
                </span>
                <span className="bd-msg-provider-name">{item.label}</span>
              </button>
            ))}
            <Form.Item name="provider" hidden>
              <Input />
            </Form.Item>
          </div>

          <div className="bd-call-dialog-fields">
            <FloatingField
              name="name"
              label={t("Tools:NameLabel")}
              required
              rules={[{ required: true, message: t("Tools:NameRequired") }]}
            >
              <Input autoFocus />
            </FloatingField>

            <FloatingField
              name="branchId"
              label={t("Tools:BranchLabel")}
              required
              rules={[{ required: true, message: t("Tools:BranchRequired") }]}
            >
              <Select
                // The update API keeps a configuration in its branch.
                disabled={config !== null}
                options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              />
            </FloatingField>

            <FloatingField
              name="apiKey"
              label={t("Tools:ApiKeyLabel")}
              required
              rules={[{ required: true, message: t("Tools:ApiKeyRequired") }]}
            >
              <Input />
            </FloatingField>

            <FloatingField
              name="secretKey"
              label={t("Tools:SecretKeyLabel")}
              required={config === null}
              // FloatingField owns the placeholder, so the keep-the-stored-key
              // hint rides Form.Item's extra line instead.
              extra={config ? t("Tools:SecretKeyHint") : undefined}
              rules={
                config === null
                  ? [{ required: true, message: t("Tools:SecretKeyRequired") }]
                  : undefined
              }
            >
              <Input.Password autoComplete="new-password" />
            </FloatingField>

            <div className="bd-call-dialog-switch">
              <span>{t("Tools:StatusLabel")}</span>
              <Form.Item name="isActive" valuePropName="checked">
                <Switch aria-label={t("Tools:StatusLabel")} />
              </Form.Item>
            </div>
          </div>
        </div>
      </Form>
    </AppDialog>
  );
}

