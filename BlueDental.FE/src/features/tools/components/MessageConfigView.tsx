import { useMemo, useState } from "react";
import { Button, Form, Input, Switch, Tag, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { activeTag } from "./callCatalog";
import { AppDialog } from "@/components/AppDialog";
import { DataTable } from "@/components/DataTable";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { pagerTotal } from "@/utils/pagerTotal";

// UNKNOWN_REFERENCE_BEHAVIOR: The reference's message config table was empty
// ("Hiển thị 0 trên 0 cấu hình"). The dialog layout mirrors the screenshot:
// provider card (FPT) on the left, fields on the right. The BE has no
// message-configurations endpoint yet — the dialog is structural only.

interface MessageConfigRow {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
}

// ── Provider cards — placeholder; only FPT observed ─────────────────────────
const MSG_PROVIDERS = [{ value: 0, label: "FPT" }];

function MessageConfigDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form] = Form.useForm();
  const provider = Form.useWatch("provider", form) ?? 0;

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
        initialValues={{ provider: 0, name: "", brandName: "", customerCode: "", secretKey: "", isActive: true }}
      >
        <div className="bd-inv-dialog-grid">
          <div>
            <div className="bd-msg-provider-label">{t("Nhà cung cấp")}</div>
            {MSG_PROVIDERS.map((item) => (
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
                  {/* UNKNOWN_REFERENCE_BEHAVIOR: exact FPT logo asset URL
                      could not be safely extracted. Using inline SVG text
                      placeholder until a proper logo is sourced. */}
                  <svg viewBox="0 0 80 40" width="80" height="40" aria-label={item.label}>
                    <text
                      x="50%"
                      y="50%"
                      dominantBaseline="central"
                      textAnchor="middle"
                      fill="#d98b0f"
                      fontFamily="Arial, sans-serif"
                      fontWeight="700"
                      fontSize="26"
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
            <FloatingField name="name" label={t("Tên")}>
              <Input autoFocus />
            </FloatingField>

            <FloatingField name="brandName" label={t("Tên thương hiệu")}>
              <Input />
            </FloatingField>

            <FloatingField name="customerCode" label={t("Mã khách hàng")}>
              <Input />
            </FloatingField>

            <FloatingField name="secretKey" label={t("Mã bí mật")}>
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

/** Cấu Hình — message provider configurations (FPT, etc.). */
export function MessageConfigView() {
  const [dialogOpen, setDialogOpen] = useState(false);

  const columns = useMemo<ColumnsType<MessageConfigRow>>(
    () => [
      { key: "name", title: t("Tên"), dataIndex: "name" },
      { key: "provider", title: t("Nhà cung cấp"), dataIndex: "provider" },
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

      <DataTable<MessageConfigRow>
        columns={columns}
        dataSource={[]}
        rowKey="id"
        loading={false}
        pagination={{ total: 0, showTotal: pagerTotal }}
        locale={{ emptyText: t("Chưa có cấu hình nào") }}
      />

      <MessageConfigDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
