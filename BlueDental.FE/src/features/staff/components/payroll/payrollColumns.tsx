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
    { title: t("Payroll:Col:Staff"), dataIndex: "staffName", fixed: "left", width: 170 },
    { title: t("Payroll:Col:BaseSalary"), dataIndex: "baseSalary", align: "right", width: 108, render: money },
    {
      title: t("Payroll:Col:WorkDays"),
      dataIndex: "payableWorkDays",
      align: "right",
      width: 88,
      render: (value: number, row) =>
        row.workDaysOverride === null ? (
          days(value)
        ) : (
          <Tooltip title={t("Payroll:WorkDaysOverrideHint", days(row.workedDays))}>
            <span className="payroll-overridden">{days(value)}</span>
          </Tooltip>
        ),
    },
    { title: t("Payroll:Col:LeaveDays"), dataIndex: "leaveDays", align: "right", width: 84, render: days },
    { title: t("Payroll:Col:SalaryByWorkDays"), dataIndex: "salaryByWorkDays", align: "right", width: 132, render: money },
    { title: t("Payroll:Col:Allowance"), dataIndex: "allowance", align: "right", width: 96, render: money },
    {
      title: t("Payroll:Col:OvertimeHours"),
      dataIndex: "overtimeMinutes",
      align: "right",
      width: 92,
      render: (minutes: number) => days(minutes / 60),
    },
    { title: t("Payroll:Col:OvertimePay"), dataIndex: "overtimePay", align: "right", width: 100, render: money },
    { title: t("Payroll:Col:Commission"), dataIndex: "commissionAmount", align: "right", width: 96, render: money },
    { title: t("Payroll:Col:Bonus"), dataIndex: "bonus", align: "right", width: 96, render: money },
    { title: t("Payroll:Col:Penalty"), dataIndex: "penaltyAmount", align: "right", width: 88, render: money },
    { title: t("Payroll:Col:OtherDeduction"), dataIndex: "otherDeduction", align: "right", width: 112, render: money },
    {
      title: t("Payroll:Col:NetSalary"),
      dataIndex: "netSalary",
      align: "right",
      width: 104,
      render: (value: number) => <strong>{money(value)}</strong>,
    },
    { title: t("Payroll:Col:Note"), dataIndex: "note", ellipsis: true, width: 180 },
  ];

  if (!onAdjust) return columns;

  return [
    ...columns,
    {
      title: t("Payroll:Col:Actions"),
      key: "actions",
      fixed: "right",
      width: 84,
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
