import { useState } from "react";
import { Button, Form, Tooltip } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import type { ColumnsType } from "antd/es/table";
import { AppDialog } from "@/components/AppDialog";
import { CurrencyInput } from "@/components/CurrencyInput";
import { DataTable } from "@/components/DataTable";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { usePayrollCommands, useStaffCompensations, type StaffCompensation } from "../../api/payrollApi";

interface Props {
  canEdit: boolean;
}

/** "Lương cơ bản & phụ cấp" — the fixed pay terms of the branch's staff. */
export function CompensationPanel({ canEdit }: Props) {
  const { data = [], isLoading } = useStaffCompensations(true);
  const { setCompensation } = usePayrollCommands();
  const [editing, setEditing] = useState<StaffCompensation | null>(null);
  const [form] = Form.useForm<{ baseSalary?: number; allowance?: number }>();

  const handleSave = async (values: { baseSalary?: number; allowance?: number }) => {
    if (!editing) return;
    try {
      await setCompensation.mutateAsync({
        staffId: editing.staffId,
        baseSalary: values.baseSalary ?? 0,
        allowance: values.allowance ?? 0,
      });
      toast.success(t("Payroll:Saved"));
      setEditing(null);
    } catch {
      // queryClient reports the failure.
    }
  };

  const columns: ColumnsType<StaffCompensation> = [
    { title: t("Payroll:Col:Staff"), dataIndex: "staffName" },
    { title: t("Payroll:Col:BaseSalary"), dataIndex: "baseSalary", align: "right", render: (v: number) => formatVND(v) },
    { title: t("Payroll:Col:Allowance"), dataIndex: "allowance", align: "right", render: (v: number) => formatVND(v) },
  ];
  if (canEdit) {
    columns.push({
      title: t("Payroll:Col:Actions"),
      key: "actions",
      width: 90,
      render: (_, row) => (
        <Tooltip title={t("Payroll:EditCompensation")}>
          <Button type="text" icon={<EditOutlined />} aria-label={t("Payroll:EditCompensation")} onClick={() => setEditing(row)} />
        </Tooltip>
      ),
    });
  }

  return (
    <div className="page-card payroll-table">
      <p className="payroll-hint">{t("Payroll:CompensationHint")}</p>
      <DataTable<StaffCompensation> columns={columns} dataSource={data} rowKey="staffId" loading={isLoading} pagination={false} />
      <AppDialog
        open={editing !== null}
        title={t("Payroll:CompensationTitle", editing?.staffName ?? "")}
        width={420}
        canSave
        saving={setCompensation.isPending}
        cancelLabel={t("Common:Cancel")}
        onSave={() => form.submit()}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <Form
            form={form}
            layout="vertical"
            preserve={false}
            onFinish={(values) => void handleSave(values)}
            initialValues={{ baseSalary: editing.baseSalary || undefined, allowance: editing.allowance || undefined }}
          >
            <Form.Item name="baseSalary" label={t("Payroll:Col:BaseSalary")}>
              <CurrencyInput suffix=" đ" />
            </Form.Item>
            <Form.Item name="allowance" label={t("Payroll:Col:Allowance")}>
              <CurrencyInput suffix=" đ" />
            </Form.Item>
          </Form>
        )}
      </AppDialog>
    </div>
  );
}
