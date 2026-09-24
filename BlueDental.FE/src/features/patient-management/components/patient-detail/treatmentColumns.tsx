import { Button, Tooltip, type TableColumnsType } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { ActionTooltip } from "@/components/ActionTooltip";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { formatToothCodes } from "@/features/treatment-management/api/consultingApi";
import {
  afterCareLabels,
  type CareStatusCode,
} from "@/features/treatment-management/api/treatmentPlanApi";
import { BriefcaseMedicalIcon, warrantyTitle } from "./stage/StageWarrantyButton";
import { stageRowStatus, stageRowStatusLabel } from "./stageRowStatus";
import type { TreatmentRow } from "./treatmentRows";

export type { TreatmentRow };

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
/** The status one row shows — see stageRowStatus for what the reference does. */
const rowStatus = (row: TreatmentRow) => stageRowStatus(row.status ?? null, row.stageDone);

export function treatmentColumns({
  onOpenPlan,
  onAddStage,
  onWarranty,
  onPay,
}: Handlers): TableColumnsType<TreatmentRow> {

  const careLabels = afterCareLabels();

  return [
    {
      title: t("Patient:Misc:Date"),
      dataIndex: "createdAt",
      width: 140,
      // One cell per day, spanning that day's công đoạn.
      onCell: (row) => ({ rowSpan: row.daySpan }),
      render: (value: string) => <span className="pd-tr-day">{formatDate(value)}</span>,
    },
    {
      title: t("Patient:Misc:ServiceLabel"),
      dataIndex: "serviceName",
      width: 190,
      render: (value: string | null, row) => (
        <div className="pd-tr-service">
          <p>
            <button type="button" className="pd-tr-code" onClick={onOpenPlan}>
              {row.recallCode ?? row.planCode}
            </button>
            {value ? ` - ${value}` : ` - ${row.code}`}
          </p>
          {/* A tái khám says so; a warranty visit reads "Bảo hành" whatever
              its state (staging's timeline, 2026-09-24); a công đoạn row shows
              its own state, not the line's. */}
          {row.kind === "reExamination" ? (
            <span className="pd-tr-chip pd-tr-chip--recall">{t("Patient:Care:RecallLower")}</span>
          ) : row.isWarranty ? (
            <span className="pd-tr-chip pd-tr-chip--warranty">{t("Patient:Labo:Warranty")}</span>
          ) : (
            <span className={`pd-tr-chip pd-tr-chip--${rowStatus(row)}`}>
              {stageRowStatusLabel(rowStatus(row))}
            </span>
          )}
        </div>
      ),
    },
    {
      title: t("Patient:Stage:TreatmentContent"),
      width: 210,
      render: (_, row) => row.stageNote ?? "—",
    },
    {
      title: t("Patient:DentalChart:Tooth"),
      dataIndex: "rowTeeth",
      width: 130,
      // Tooth numbers only: the reference's timeline prints no surfaces here.
      render: (_, row) =>
        row.rowTeeth.length === 0 ? (
          "—"
        ) : (
          <span className="pd-tr-teeth">{formatToothCodes(row.rowTeeth)}</span>
        ),
    },
    { title: t("SL"), dataIndex: "quantity", width: 60, align: "center" },
    {
      title: t("Patient:Staff:TreatingDoctor"),
      dataIndex: "dentist",
      width: 190,
      render: (value: string | null, row) => (
        <div className="pd-tr-doctor">
          <div>{value ?? "—"}</div>
          {/* Phụ tá rides on the công đoạn, so it is the row's own, not the
              plan's — and the reference leaves the line off a tái khám row. */}
          {row.kind === "stage" && (
            <div className="pd-tr-sub">
              {t("Patient:Staff:Assistant")}: {row.assistant ?? "—"}
            </div>
          )}
        </div>
      ),
    },
    {
      title: t("Patient:Staff:AssistingDoctor"),
      width: 170,
      render: (_, row) => row.secondDentist ?? t("Patient:Misc:None"),
    },
    {
      title: t("Patient:Stage:Title"),
      width: 120,
      align: "center",
      render: (_, row) => {
        // A tái khám is not a công đoạn, and the reference leaves this cell of
        // its row empty.
        if (row.kind === "reExamination") return null;

        // Three states, as the reference draws them. A công đoạn still being
        // worked keeps the green + — adding a new one never closes the old, so
        // every unfinished row stays clickable.
        if (!row.stageDone) {
          // The reference counts its stage *checklist* here
          // (stageServiceItems), which BlueDental does not model, and the công
          // đoạn themselves are already a row each.
          return (
            <Tooltip title={t("Patient:Stage:Add")}>
              <Button
                type="text"
                className="pd-tr-addstage"
                icon={<PlusOutlined />}
                aria-label={t("Patient:Stage:Add")}
                onClick={() => onAddStage(row)}
              />
            </Tooltip>
          );
        }

        // Finished, but no warranty on offer: the service carries none, or
        // the row stands for a line that never had a công đoạn.
        const { warranty } = row;
        if (warranty.kind === "none" || warranty.kind === "noWarranty") {
          return (
            <Tooltip title={t("Patient:Labo:NoWarranty")}>
              <span className="pd-tr-nostage" aria-label={t("Patient:Labo:NoWarranty")}>
                <BriefcaseMedicalIcon />
              </span>
            </Tooltip>
          );
        }

        // Grey and disabled while another warranty of the line is open or
        // once the period ran out; the tooltip says which.
        return (
          <ActionTooltip title={warrantyTitle(warranty)}>
            <Button
              type="text"
              className="pd-tr-warranty"
              aria-label={t("Patient:Labo:Warranty")}
              icon={<BriefcaseMedicalIcon />}
              disabled={warranty.kind === "blocked"}
              onClick={() => onWarranty(row)}
            />
          </ActionTooltip>
        );
      },
    },
    {
      title: t("Patient:Care:AfterTreatment"),
      dataIndex: "afterCareStatus",
      width: 180,
      render: (value: CareStatusCode | null, row) =>
        // Aftercare follows a công đoạn; the reference leaves it off a tái khám.
        row.kind === "reExamination" ? null : (
          <span className="pd-tr-care">
            <i />
            {value === null ? t("Patient:Care:NotCared") : careLabels[value]}
          </span>
        ),
    },
    {
      title: t("Common:Actions"),
      width: 90,
      align: "center",
      fixed: "right",
      // A warranty visit costs nothing, and staging offers no payment on it.
      render: (_, row) =>
        row.isWarranty ? null : (
          <Tooltip title={t("Patient:Payment:CreateSlip")}>
            <Button
              type="text"
              className="pd-tr-pay"
              icon={<BanknoteIcon />}
              aria-label={t("Patient:Payment:CreateSlip")}
              onClick={() => onPay(row)}
            />
          </Tooltip>
        ),
    },
  ];
}
