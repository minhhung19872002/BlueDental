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
      title={t("Cấu hình")}
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
            <div className="bd-msg-provider-label">{t("Nhà cung cấp")}</div>
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
            <FloatingField name="name" label={t("Tên")}>
              <Input autoFocus />
            </FloatingField>

            {/* UNKNOWN_REFERENCE_BEHAVIOR: "Chi nhánh" options source is
                unknown — not the clinic branches. Placeholder until clarified. */}
            <FloatingField name="branchId" label={t("Chi nhánh")}>
              <Select options={[]} />
            </FloatingField>

            <FloatingField name="appId" label={t("App ID")}>
              <Input />
            </FloatingField>

            <FloatingField name="taxCode" label={t("Mã số thuế")}>
              <Input />
            </FloatingField>

            <FloatingField name="username" label={t("Tên đăng nhập")}>
              <Input />
            </FloatingField>

            <FloatingField name="password" label={t("Mật khẩu")}>
              <Input.Password autoComplete="new-password" />
            </FloatingField>

            <div className="bd-call-dialog-switch">
              <span>{t("Tính thuế theo dịch vụ")}</span>
              <Form.Item name="taxByService" valuePropName="checked">
                <Switch aria-label={t("Tính thuế theo dịch vụ")} />
              </Form.Item>
            </div>

            <div className="bd-call-dialog-switch">
              <span>{t("Tính thuế theo giai đoạn")}</span>
              <Form.Item name="taxByPeriod" valuePropName="checked">
                <Switch aria-label={t("Tính thuế theo giai đoạn")} />
              </Form.Item>
            </div>

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

/** Cấu Hình — invoice provider configurations (MISA, etc.). */
export function InvoiceConfigView() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const columns = useMemo<ColumnsType<InvoiceConfigRow>>(
    () => [
      { key: "name", title: t("Tên"), dataIndex: "name" },
      { key: "branch", title: t("Tên chi nhánh"), dataIndex: "branchName" },
      {
        key: "module",
        title: t("Mô đun"),
        width: 120,
        render: (_, row) => <Tag color="blue">{row.module}</Tag>,
      },
      {
        key: "provider",
        title: t("Nhà cung cấp"),
        width: 140,
        render: (_, row) => <Tag>{row.provider}</Tag>,
      },
      {
        key: "status",
        title: t("Trạng thái"),
        width: 130,
        render: (_, row) => {
          const { label, color } = activeTag(row.isActive);
          return <Tag color={color}>{label}</Tag>;
        },
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 110,
        align: "center",
        render: (_, row) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Chỉnh sửa")}>
              <Button type="text" size="small" icon={<EditOutlined />} aria-label={t("Chỉnh sửa {0}", row.name)} />
            </Tooltip>
            <Tooltip title={t("Xoá")}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t("Xoá {0}", row.name)} />
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
          placeholder={t("Tìm kiếm")}
          aria-label={t("Tìm kiếm")}
          allowClear
        />
        <Button
          className="bd-tools-toolbar-end"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDialogOpen(true)}
        >
          {t("Tạo cấu hình")}
        </Button>
      </div>

      <DataTable<InvoiceConfigRow>
        columns={columns}
        dataSource={[]}
        rowKey="id"
        loading={false}
        pagination={{ total: 0, showTotal: pagerTotal }}
        locale={{ emptyText: t("Chưa có cấu hình nào") }}
      />

      <InvoiceConfigDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
