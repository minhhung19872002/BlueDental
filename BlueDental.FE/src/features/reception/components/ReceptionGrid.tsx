import { CalendarX } from "lucide-react";
import { DataGrid, type DataGridColumn } from "@/components/DataGrid";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { formatClock } from "@/utils/format";
import type {
  ReceptionItem,
  AppointmentOutcome,
  AppointmentCounterType,
} from "../types/reception";

interface Props {
  items: ReceptionItem[];
  doctors?: { id: string; name: string; title: string }[];
  onOutcomeChange?: (id: string, outcome: AppointmentOutcome) => void;
  onDoctorChange?: (id: string, doctorId: string) => void;
  onCancel?: (id: string) => void;
}

/** One token per counter status, used for both the pill's text and its wash. */
const STATUS_COLOR: Record<AppointmentCounterType, string> = {
  Scheduled: "var(--bd-blue)",
  Arrived: "var(--bd-green-bright)",
  Cancelled: "var(--bd-red)",
  Late: "var(--bd-gold-deep)",
  Temporary: "var(--bd-purple)",
  Converted: "var(--bd-teal)",
};

type NonNullOutcome = Exclude<AppointmentOutcome, null>;

const OUTCOME_KEYS: NonNullOutcome[] = [
  "EndTreatment",
  "FollowUp",
  "TransferDoctor",
  "Revisit",
];

/**
 * Reception as the design draws its lists.
 *
 * The design's own reception artboard has six columns — time, customer,
 * service, doctor, status, action — and a single "Chuyển →" button. This screen
 * carries more than that: a three-step progress through the visit and four
 * outcome choices at the end of it. Rather than drop them, they become two
 * further columns in the same grid, so the list keeps the design's shape
 * without losing what the screen is for.
 */
export function ReceptionGrid({
  items,
  doctors = [],
  onOutcomeChange,
  onDoctorChange,
  onCancel,
}: Props) {
  const statusLabel: Record<AppointmentCounterType, string> = {
    Scheduled: t("Reception:StatusScheduled"),
    Arrived: t("Reception:StatusArrived"),
    Cancelled: t("Reception:StatusCancelled"),
    Late: t("Reception:StatusLate"),
    Temporary: t("Reception:StatusTemporary"),
    Converted: t("Reception:StatusConverted"),
  };

  const outcomeLabel: Record<NonNullOutcome, string> = {
    EndTreatment: t("Reception:OutcomeEndTreatment"),
    FollowUp: t("Reception:OutcomeFollowUp"),
    TransferDoctor: t("Reception:OutcomeTransferDoctor"),
    Revisit: t("Reception:OutcomeRevisit"),
  };

  const stepLabel = [t("Reception:StatusArrived"), t("Reception:StepInProgress"), t("Reception:StepComplete")];

  const columns: DataGridColumn<ReceptionItem>[] = [
    {
      key: "time",
      title: t("Reception:ColTime"),
      width: "76px",
      render: (r) => (
        <span className="dg-key">{formatClock(r.arrivalTime || r.appointmentTime)}</span>
      ),
    },
    {
      key: "patient",
      title: t("Reception:ColCustomer"),
      width: "minmax(0, 1.7fr)",
      render: (r) => (
        <>
          <span className="dg-name">{r.patientName}</span>
          <span className="dg-sub">{r.voucherCode}</span>
        </>
      ),
    },
    {
      key: "services",
      title: t("Reception:ColService"),
      width: "minmax(0, 1.2fr)",
      render: (r) => <span>{r.services.length > 0 ? r.services.join(", ") : "—"}</span>,
    },
    {
      key: "doctor",
      title: t("Reception:Doctor"),
      width: "minmax(150px, 1fr)",
      clip: false,
      render: (r) => (
        <SearchSelect
          value={r.doctorId || undefined}
          placeholder={t("Reception:SelectDoctor")}
          options={doctors.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(v) => onDoctorChange?.(r.id, String(v))}
        />
      ),
    },
    {
      key: "status",
      title: t("Common:Status"),
      width: "126px",
      clip: false,
      render: (r) =>
        r.counterStatus ? (
          <span
            className="dg-pill"
            style={{ "--pill-color": STATUS_COLOR[r.counterStatus] } as React.CSSProperties}
          >
            {statusLabel[r.counterStatus]}
          </span>
        ) : (
          <span className="dg-cell">—</span>
        ),
    },
    {
      key: "progress",
      title: t("Reception:ColProgress"),
      width: "168px",
      clip: false,
      render: (r) => {
        const times = [r.step1Time, r.step2Time, r.step3Time];
        return (
          <div className="rec-steps">
            {times.map((time, i) => (
              <div key={stepLabel[i]} className="rec-step" title={stepLabel[i]}>
                <span className={`rec-step-dot${time ? " rec-step-dot--done" : ""}`}>
                  {i + 1}
                </span>
                <span className="rec-step-time">{formatClock(time)}</span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: "outcome",
      title: t("Reception:ColOutcome"),
      width: "minmax(232px, 1.1fr)",
      clip: false,
      render: (r) => (
        <div className="rec-outcomes">
          {OUTCOME_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`rec-outcome${r.selectedOutcome === key ? " rec-outcome--on" : ""}`}
              onClick={() => onOutcomeChange?.(r.id, key)}
            >
              {outcomeLabel[key]}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "actions",
      title: t("Common:Actions"),
      width: "84px",
      clip: false,
      render: (r) => (
        <button
          type="button"
          className="dg-action rec-cancel"
          aria-label={t("Reception:CancelAppointment")}
          title={t("Reception:CancelAppointment")}
          onClick={() => onCancel?.(r.id)}
        >
          <CalendarX size={14} />
        </button>
      ),
    },
  ];

  return (
    <DataGrid
      columns={columns}
      rows={items}
      rowKey={(r) => r.id}
      minWidth={1180}
      empty={t("Reception:EmptyTitle")}
    />
  );
}
