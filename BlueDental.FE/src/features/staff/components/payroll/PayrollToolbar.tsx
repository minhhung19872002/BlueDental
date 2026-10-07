import { Button, DatePicker, Space, Tag } from "antd";
import { CalculatorOutlined, DeleteOutlined, DownloadOutlined, LockOutlined, SettingOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { PAYROLL_STATUS, type PayrollPeriod } from "../../api/payrollApi";

export interface PayrollToolbarActions {
  onRecalculate?: () => void;
  onTerms?: () => void;
  onFinalize?: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}

interface Props {
  month: Dayjs;
  onMonthChange: (month: Dayjs) => void;
  period?: PayrollPeriod;
  busy: boolean;
  actions: PayrollToolbarActions;
}

/** Month picker, the sheet's status and terms, and what may be done with it. */
export function PayrollToolbar({ month, onMonthChange, period, busy, actions }: Props) {
  const draft = period?.status === PAYROLL_STATUS.Draft;

  return (
    <div className="page-card payroll-toolbar">
      <Space wrap size={12}>
        <DatePicker
          picker="month"
          format="MM/YYYY"
          allowClear={false}
          value={month}
          aria-label={t("Payroll:Month")}
          onChange={(value) => value && onMonthChange(value.startOf("month"))}
        />
        {period && (
          <>
            <Tag color={draft ? "default" : "green"}>
              {t(draft ? "Payroll:Status:Draft" : "Payroll:Status:Finalized")}
            </Tag>
            <span className="payroll-toolbar__terms">
              {t("Payroll:StandardWorkDays")}: <strong>{period.standardWorkDays}</strong> · {t("Payroll:OvertimeRate")}:{" "}
              <strong>{period.overtimeRate}</strong>
            </span>
            <span className="payroll-toolbar__total">
              {t("Payroll:NetTotal")}: <strong>{formatVND(period.netTotal)} đ</strong>
            </span>
            {!draft && period.finalizedAt && (
              <span className="payroll-toolbar__terms">
                {t("Payroll:FinalizedBy", period.finalizedByName ?? "", dayjs(period.finalizedAt).format("DD/MM/YYYY HH:mm"))}
              </span>
            )}
          </>
        )}
      </Space>
      {period && (
        <Space wrap size={8} className="payroll-toolbar__actions">
          {draft && actions.onRecalculate && (
            <Button icon={<CalculatorOutlined />} loading={busy} onClick={actions.onRecalculate}>
              {t("Payroll:Recalculate")}
            </Button>
          )}
          {draft && actions.onTerms && (
            <Button icon={<SettingOutlined />} onClick={actions.onTerms}>
              {t("Payroll:Terms")}
            </Button>
          )}
          {actions.onExport && (
            <Button icon={<DownloadOutlined />} onClick={actions.onExport}>
              {t("Payroll:Export")}
            </Button>
          )}
          {draft && actions.onDelete && (
            <Button danger icon={<DeleteOutlined />} onClick={actions.onDelete}>
              {t("Payroll:Delete")}
            </Button>
          )}
          {draft && actions.onFinalize && (
            <Button type="primary" icon={<LockOutlined />} onClick={actions.onFinalize}>
              {t("Payroll:Finalize")}
            </Button>
          )}
        </Space>
      )}
    </div>
  );
}
