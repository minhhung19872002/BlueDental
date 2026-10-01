import { useEffect } from "react";
import { Form, Input, Select, Switch } from "antd";
import { toast } from "sonner";
import {
  useCreateEInvoiceConfig,
  useUpdateEInvoiceConfig,
  type CreateUpdateEInvoiceConfigDto,
  type EInvoiceConfigDto,
} from "../api/eInvoiceConfigApi";
import { EINVOICE_PROVIDER_LOGO, EINVOICE_PROVIDER_NAME } from "./eInvoiceConfigCatalog";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useClinicBranches } from "@/features/organizations/api";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  config: EInvoiceConfigDto | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
  clinicBranchId: string;
  appId: string;
  taxCode: string;
  username: string;
  password: string;
  taxByService: boolean;
  taxByPeriod: boolean;
  isActive: boolean;
}

const blank: FormValues = {
  name: "",
  clinicBranchId: "",
  appId: "",
  taxCode: "",
  username: "",
  password: "",
  taxByService: false,
  taxByPeriod: false,
  isActive: true,
};

/**
 * The original Cấu hình dialog, field for field, saving to the branch's
 * EasyInvoice account. Like the original it has no field rules — the server
 * refuses a blank name, MST, user or new password and the toast says so.
 * The password never comes back, so an edit shows it blank and blank keeps it.
 */
export function EInvoiceConfigDialog({ open, config, onClose }: Props) {
  const currentBranchId = useCurrentBranchId();
  const { data: branches } = useClinicBranches(true);
  const createConfig = useCreateEInvoiceConfig();
  const updateConfig = useUpdateEInvoiceConfig();
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      config
        ? { ...config, appId: config.appId ?? "", password: "" }
        : { ...blank, clinicBranchId: currentBranchId },
    );
  }, [open, config, currentBranchId, form]);

  const pending = createConfig.isPending || updateConfig.isPending;

  const handleFinish = (values: FormValues) => {
    const data: CreateUpdateEInvoiceConfigDto = {
      clinicBranchId: values.clinicBranchId,
      name: values.name.trim(),
      appId: values.appId.trim() || null,
      username: values.username.trim(),
      password: values.password.trim() || undefined,
      taxCode: values.taxCode.trim(),
      taxByService: values.taxByService,
      taxByPeriod: values.taxByPeriod,
      isActive: values.isActive,
    };
    const done = (key: string) => () => {
      toast.success(t(key));
      onClose();
    };
    if (config) {
      updateConfig.mutate({ id: config.id, data }, { onSuccess: done("Tools:ConfigUpdated") });
    } else {
      createConfig.mutate(data, { onSuccess: done("Tools:ConfigCreated") });
    }
  };

  return (
    <AppDialog
      open={open}
      title={t("Tools:ConfigDialogTitle")}
      width={772}
      canSave
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form form={form} layout="vertical" requiredMark={false} initialValues={blank} onFinish={handleFinish}>
        <div className="bd-inv-dialog-grid">
          <div>
            <div className="bd-msg-provider-label">{t("Tools:ProviderLabel")}</div>
            <button type="button" className="bd-msg-provider-card bd-msg-provider-card--active" aria-pressed>
              <span className="bd-msg-provider-img bd-msg-provider-img--logo">
                <img src={EINVOICE_PROVIDER_LOGO} alt={EINVOICE_PROVIDER_NAME} />
              </span>
              <span className="bd-msg-provider-name">{EINVOICE_PROVIDER_NAME}</span>
            </button>
          </div>

          <div className="bd-call-dialog-fields">
            <FloatingField name="name" label={t("Tools:NameLabel")}>
              <Input autoFocus />
            </FloatingField>

            <FloatingField name="clinicBranchId" label={t("Tools:BranchLabel")}>
              <Select
                // A config stays in the branch it was made for.
                disabled={config !== null}
                options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
              />
            </FloatingField>

            <FloatingField name="appId" label={t("Tools:AppIdLabel")}>
              <Input />
            </FloatingField>

            <FloatingField name="taxCode" label={t("Tools:TaxCodeLabel")}>
              <Input />
            </FloatingField>

            <FloatingField name="username" label={t("Tools:UsernameLabel")}>
              <Input autoComplete="off" />
            </FloatingField>

            <FloatingField name="password" label={t("Tools:PasswordLabel")}>
              <Input.Password autoComplete="new-password" />
            </FloatingField>

            <div className="bd-call-dialog-switch">
              <span>{t("Tools:TaxByServiceLabel")}</span>
              <Form.Item name="taxByService" valuePropName="checked">
                <Switch aria-label={t("Tools:TaxByServiceLabel")} />
              </Form.Item>
            </div>

            <div className="bd-call-dialog-switch">
              <span>{t("Tools:TaxByPeriodLabel")}</span>
              <Form.Item name="taxByPeriod" valuePropName="checked">
                <Switch aria-label={t("Tools:TaxByPeriodLabel")} />
              </Form.Item>
            </div>

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
