import { Button, Tooltip } from "antd";
import { EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { PayrollEntry } from "../../api/payrollApi";

const money = (value: number) => formatVND(value);
const days = (value: number) => value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

/** The Bảng lương row; "Điều chỉnh" only while the sheet is a draft and the account may edit it. */
export function payrollColumns(onAdjust?: (entry: PayrollEntry) => void): ColumnsType<PayrollEntry> {
  const columns: ColumnsType<PayrollEntry> = [
    { title: t("Payroll:Col:Staff"), dataIndex: "staffName", fixed: "left", width: 180 },
    { title: t("Payroll:Col:BaseSalary"), dataIndex: "baseSalary", align: "right", render: money },
    {
      title: t("Payroll:Col:WorkDays"),
      dataIndex: "payableWorkDays",
      align: "right",
      render: (value: number, row) =>
        row.workDaysOverride === null ? (
          days(value)
        ) : (
          <Tooltip title={t("Payroll:WorkDaysOverrideHint", days(row.workedDays))}>
            <span className="payroll-overridden">{days(value)}</span>
          </Tooltip>
        ),
    },
    { title: t("Payroll:Col:LeaveDays"), dataIndex: "leaveDays", align: "right", render: days },
    { title: t("Payroll:Col:SalaryByWorkDays"), dataIndex: "salaryByWorkDays", align: "right", render: money },
    { title: t("Payroll:Col:Allowance"), dataIndex: "allowance", align: "right", render: money },
    {
      title: t("Payroll:Col:OvertimeHours"),
      dataIndex: "overtimeMinutes",
      align: "right",
      render: (minutes: number) => days(minutes / 60),
    },
    { title: t("Payroll:Col:OvertimePay"), dataIndex: "overtimePay", align: "right", render: money },
    { title: t("Payroll:Col:Commission"), dataIndex: "commissionAmount", align: "right", render: money },
    { title: t("Payroll:Col:Bonus"), dataIndex: "bonus", align: "right", render: money },
    { title: t("Payroll:Col:Penalty"), dataIndex: "penaltyAmount", align: "right", render: money },
    { title: t("Payroll:Col:OtherDeduction"), dataIndex: "otherDeduction", align: "right", render: money },
    {
      title: t("Payroll:Col:NetSalary"),
      dataIndex: "netSalary",
      align: "right",
      render: (value: number) => <strong>{money(value)}</strong>,
    },
    { title: t("Payroll:Col:Note"), dataIndex: "note", ellipsis: true, width: 160 },
  ];

  if (!onAdjust) return columns;

  return [
    ...columns,
    {
      title: t("Payroll:Col:Actions"),
      key: "actions",
      fixed: "right",
      width: 90,
      render: (_, row) => (
        <Tooltip title={t("Payroll:Adjust")}>
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label={t("Payroll:Adjust")}
            onClick={() => onAdjust(row)}
          />
        </Tooltip>
      ),
    },
  ];
}
