import { useEffect, useMemo, useState } from "react";
import { Button, Form, Input, Select, Switch, Tag, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { activeTag } from "./callCatalog";
import { AppDialog } from "@/components/AppDialog";
import { DataTable } from "@/components/DataTable";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { pagerTotal } from "@/utils/pagerTotal";

// UNKNOWN_REFERENCE_BEHAVIOR: The reference's invoice config table had 2 rows
// ("Quang Vinh" and "Thuế Hồ Nai") with provider "MISA" and module "Hóa đơn".
// The BE has no invoice-configurations endpoint yet — the dialog is structural only.

interface InvoiceConfigRow {
  id: string;
  name: string;
  branchName: string;
  module: string;
  provider: string;
  isActive: boolean;
}

const INV_PROVIDERS = [{ value: 0, label: "Misa" }];

interface DialogProps {
  open: boolean;
  onClose: () => void;
}

function InvoiceConfigDialog({ open, onClose }: DialogProps) {
  const [form] = Form.useForm();
  const provider = Form.useWatch("provider", form) ?? 0;

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      provider: 0,
      name: "",
      branchId: "",
      appId: "",
      taxCode: "",
      username: "",
      password: "",
      taxByService: false,
      taxByPeriod: false,
      isActive: true,
    });
  }, [open, form]);

  return (
    <AppDialog
      open={open}
      title={t("Tools:ConfigDialogTitle")}
      width={772}
      canSave={false}
      saving={false}
      onSave={() => {}}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{
          provider: 0, name: "", branchId: "", appId: "",
          taxCode: "", username: "", password: "",
          taxByService: false, taxByPeriod: false, isActive: true,
        }}
      >
        <div className="bd-inv-dialog-grid">
          <div>
            <div className="bd-msg-provider-label">{t("Tools:ProviderLabel")}</div>
            {INV_PROVIDERS.map((item) => (
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
                  {/* UNKNOWN_REFERENCE_BEHAVIOR: exact MISA logo asset URL
                      could not be safely extracted. Using inline SVG text
                      placeholder until a proper logo is sourced. */}
                  <svg viewBox="0 0 100 50" width="100" height="50" aria-label={item.label}>
                    <text
                      x="50%"
                      y="38%"
                      dominantBaseline="central"
                      textAnchor="middle"
                      fill="#171c33"
                      fontFamily="Arial, sans-serif"
                      fontWeight="700"
                      fontSize="28"
                    >
                      MISA
                    </text>
                    <text
                      x="50%"
                      y="76%"
                      dominantBaseline="central"
                      textAnchor="middle"
                      fill="#888"
                      fontFamily="Arial, sans-serif"
                      fontWeight="400"
                      fontSize="7"
                      letterSpacing="1"
                    >
                      TIN CẬY·TIỆN ÍCH·TÂN TÌNH
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
            <FloatingField name="name" label={t("Tools:NameLabel")}>
              <Input autoFocus />
            </FloatingField>

            {/* UNKNOWN_REFERENCE_BEHAVIOR: "Chi nhánh" options source is
                unknown — not the clinic branches. Placeholder until clarified. */}
            <FloatingField name="branchId" label={t("Tools:BranchLabel")}>
              <Select options={[]} />
            </FloatingField>

            <FloatingField name="appId" label={t("Tools:AppIdLabel")}>
              <Input />
            </FloatingField>

            <FloatingField name="taxCode" label={t("Tools:TaxCodeLabel")}>
              <Input />
            </FloatingField>

            <FloatingField name="username" label={t("Tools:UsernameLabel")}>
              <Input />
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

/** Cấu Hình — invoice provider configurations (MISA, etc.). */
export function InvoiceConfigView() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const columns = useMemo<ColumnsType<InvoiceConfigRow>>(
    () => [
      { key: "name", title: t("Tools:NameLabel"), dataIndex: "name" },
      { key: "branch", title: t("Tools:BranchNameCol"), dataIndex: "branchName" },
      {
        key: "module",
        title: t("Tools:ModuleCol"),
        width: 120,
        render: (_, row) => <Tag color="blue">{row.module}</Tag>,
      },
      {
        key: "provider",
        title: t("Tools:ProviderLabel"),
        width: 140,
        render: (_, row) => <Tag>{row.provider}</Tag>,
      },
      {
        key: "status",
        title: t("Tools:StatusLabel"),
        width: 130,
        render: (_, row) => {
          const { label, color } = activeTag(row.isActive);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        key: "actions",
        title: t("Tools:ActionsLabel"),
        width: 110,
        align: "center",
        fixed: "right",
        render: (_, row) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Common:Edit")}>
              <Button type="text" size="small" icon={<EditOutlined />} aria-label={t("Tools:EditConfigAria", row.name)} />
            </Tooltip>
            <Tooltip title={t("Common:Delete")}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t("Tools:DeleteConfigAria", row.name)} />
            </Tooltip>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="reception-card reception-card--content">
      <div className="bd-ops-toolbar">
        <Input
          className="bd-ops-search"
          prefix={<SearchOutlined />}
          placeholder={t("Tools:SearchPlaceholder")}
          aria-label={t("Tools:SearchPlaceholder")}
          allowClear
        />
        <Button
          className="bd-tools-toolbar-end"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDialogOpen(true)}
        >
          {t("Tools:CreateConfig")}
        </Button>
      </div>

      <DataTable<InvoiceConfigRow>
        columns={columns}
        dataSource={[]}
        rowKey="id"
        loading={false}
        pagination={{ total: 0, showTotal: pagerTotal }}
        locale={{ emptyText: t("Tools:NoConfigs") }}
      />

      <InvoiceConfigDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

