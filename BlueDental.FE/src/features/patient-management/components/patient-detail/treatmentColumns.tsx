import { Button, Tooltip, type TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { formatTeeth } from "@/features/treatment-management/api/consultingApi";
import {
  afterCareLabels,
  serviceLineStatusConfig,
  SERVICE_LINE_STATUS,
  type CareStatusCode,
  type TreatmentServiceStatus,
} from "@/features/treatment-management/api/treatmentPlanApi";
import type { TreatmentRow } from "./treatmentRows";

export type { TreatmentRow };

/** lucide-briefcase-medical, the glyph the reference greys out on a done line. */
function BriefcaseMedicalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 11v4" />
      <path d="M14 13h-4" />
      <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M18 6v14" />
      <path d="M6 6v14" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}

interface Handlers {
  /** The DT… code opens the slip it belongs to. */
  onOpenPlan: () => void;
  /** Công đoạn — opens "Chi tiết phiếu", where a công đoạn is added. */
  onAddStage: (row: TreatmentRow) => void;
  /** Bảo hành — offered once the row's công đoạn is finished. */
  onWarranty: (row: TreatmentRow) => void;
  /** Thao tác — "Tạo phiếu thanh toán" for this row. */
  onPay: (row: TreatmentRow) => void;
}

/** The banknote glyph the reference puts under Thao tác. */
function BanknoteIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

/**
 * The ten columns the reference shows, in its order and widths.
 *
 * A row is one **công đoạn** — see {@link buildTreatmentRows} — so Ngày spans
 * its whole day through `rowSpan`, exactly as the reference's table does.
 */
export function treatmentColumns({
  onOpenPlan,
  onAddStage,
  onWarranty,
  onPay,
}: Handlers): TableColumnsType<TreatmentRow> {
  const lineStatus = serviceLineStatusConfig();
  const careLabels = afterCareLabels();

  return [
    {
      title: t("Ngày"),
      dataIndex: "createdAt",
      width: 140,
      // One cell per day, spanning that day's công đoạn.
      onCell: (row) => ({ rowSpan: row.daySpan }),
      render: (value: string) => <span className="pd-tr-day">{formatDate(value)}</span>,
    },
    {
      title: t("Dịch vụ"),
      dataIndex: "serviceName",
      width: 190,
      render: (value: string | null, row) => (
        <div className="pd-tr-service">
          <p>
            <button type="button" className="pd-tr-code" onClick={onOpenPlan}>
              {row.planCode}
            </button>
            {value ? ` - ${value}` : ` - ${row.code}`}
          </p>
          {/* The chip is the công đoạn's own state, not the line's. */}
          <span
            className={`pd-tr-chip pd-tr-chip--${
              row.stageDone ? SERVICE_LINE_STATUS.Done : SERVICE_LINE_STATUS.InProgress
            }`}
          >
            {
              lineStatus[
                (row.stageDone
                  ? SERVICE_LINE_STATUS.Done
                  : SERVICE_LINE_STATUS.InProgress) as TreatmentServiceStatus
              ].label
            }
          </span>
        </div>
      ),
    },
    {
      title: t("Nội dung điều trị"),
      width: 210,
      render: (_, row) => row.stageNote ?? "—",
    },
    {
      title: t("Răng"),
      dataIndex: "rowTeeth",
      width: 130,
      render: (_, row) =>
        row.rowTeeth.length === 0 ? (
          "—"
        ) : (
          <span className="pd-tr-teeth">{formatTeeth(row.rowTeeth)}</span>
        ),
    },
    { title: t("SL"), dataIndex: "quantity", width: 60, align: "center" },
    {
      title: t("Bác sĩ điều trị"),
      dataIndex: "dentist",
      width: 190,
      render: (value: string | null, row) => (
        <div className="pd-tr-doctor">
          <div>{value ?? "—"}</div>
          {/* Phụ tá rides on the công đoạn, so it is the row's own, not the plan's. */}
          <div className="pd-tr-sub">
            {t("Phụ tá")}: {row.assistant ?? "—"}
          </div>
        </div>
      ),
    },
    {
      title: t("Bác sĩ hỗ trợ"),
      width: 170,
      render: (_, row) => row.secondDentist ?? t("Không có"),
    },
    {
      title: t("Công đoạn"),
      width: 120,
      align: "center",
      render: (_, row) => {
        // Three states, as the reference draws them. A công đoạn still being
        // worked keeps the green + — adding a new one never closes the old, so
        // every unfinished row stays clickable.
        if (!row.stageDone) {
          // The reference counts its stage *checklist* here
          // (stageServiceItems), which BlueDental does not model, and the công
          // đoạn themselves are already a row each.
          return (
            <Tooltip title={t("Thêm công đoạn")}>
              <Button
                type="text"
                className="pd-tr-addstage"
                icon={<PlusOutlined />}
                aria-label={t("Thêm công đoạn")}
                onClick={() => onAddStage(row)}
              />
            </Tooltip>
          );
        }

        // Finished, but the service carries no warranty period.
        if (row.warrantyDays <= 0) {
          return (
            <Tooltip title={t("Không bảo hành")}>
              <span className="pd-tr-nostage" aria-label={t("Không bảo hành")}>
                <BriefcaseMedicalIcon />
              </span>
            </Tooltip>
          );
        }

        return (
          <Tooltip title={t("Bảo hành")}>
            <Button
              type="text"
              className="pd-tr-warranty"
              aria-label={t("Bảo hành")}
              icon={<BriefcaseMedicalIcon />}
              onClick={() => onWarranty(row)}
            />
          </Tooltip>
        );
      },
    },
    {
      title: t("Chăm sóc sau điều trị"),
      dataIndex: "afterCareStatus",
      width: 180,
      render: (value: CareStatusCode | null) => (
        <span className="pd-tr-care">
          <i />
          {value === null ? t("Chưa chăm sóc") : careLabels[value]}
        </span>
      ),
    },
    {
      title: t("Thao tác"),
      width: 90,
      align: "center",
      fixed: "right",
      render: (_, row) => (
        <Tooltip title={t("Tạo phiếu thanh toán")}>
          <Button
            type="text"
            className="pd-tr-pay"
            icon={<BanknoteIcon />}
            aria-label={t("Tạo phiếu thanh toán")}
            onClick={() => onPay(row)}
          />
        </Tooltip>
      ),
    },
  ];
}
