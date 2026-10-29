import { useState } from "react";
import { Button, Modal } from "antd";
import {
  DentitionRadio,
  ToothChart,
  dentitionOf,
  toothSelectionToPick,
  type Dentition,
} from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import { StageChartButton } from "./StageChartButton";
import type { HistoryTooth } from "./stageModel";

interface Props {
  /** Every tooth of the row's service, each marked worked, done or neither. */
  teeth: HistoryTooth[];
  serviceName: string;
}

const LEGEND = [
  { tone: "worked", label: "Patient:Stage:ChartWorked" },
  { tone: "done", label: "Patient:Stage:ChartDone" },
  { tone: "outside", label: "Patient:Stage:ChartOutside" },
] as const;

const picksOf = (teeth: HistoryTooth[]) => teeth.map(({ tooth }) => toothSelectionToPick(tooth));
const codesOf = (teeth: HistoryTooth[]) => new Set(teeth.map(({ tooth }) => tooth.toothCode));

/** The dialog's body, rebuilt on every opening so the dentition starts from the row's teeth. */
function HistoryChart({ teeth }: Pick<Props, "teeth">) {
  const [dentition, setDentition] = useState<Dentition>(() => dentitionOf(picksOf(teeth)));
  const marked = teeth.filter(({ state }) => state !== "idle");

  return (
    <>
      <div className="pd-stage-charthead">
        <ul className="pd-stage-chartlegend">
          {LEGEND.map(({ tone, label }) => (
            <li key={tone} className={`pd-stage-chartlegend--${tone}`}>
              {t(label)}
            </li>
          ))}
        </ul>
        <DentitionRadio value={dentition} onChange={setDentition} />
      </div>
      <div className="pd-stage-chart">
        <ToothChart
          value={picksOf(marked)}
          dentition={dentition}
          offeredTeeth={codesOf(teeth)}
          doneTeeth={codesOf(marked.filter(({ state }) => state === "done"))}
          interaction="view"
        />
      </div>
    </>
  );
}

/**
 * A history row's teeth, kept behind the jaw button — the project owner's call
 * (2026-10-29): the row no longer lists the tooth numbers. The chart opens only
 * to be looked at, coloured as the chips were: this công đoạn's teeth blue,
 * finished ones green (BA, 2026-10-05), the service's other teeth plain and the
 * rest of the mouth grey. A công đoạn with no teeth to show offers no button.
 */
export function StageHistoryTeeth({ teeth, serviceName }: Props) {
  const [open, setOpen] = useState(false);
  if (teeth.length === 0) return null;

  return (
    <>
      <StageChartButton onClick={() => setOpen(true)} />
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        width="min(1024px, calc(100vw - 32px))"
        title={t("Patient:Stage:ChartTitle", serviceName)}
        footer={<Button onClick={() => setOpen(false)}>{t("Common:Close")}</Button>}
        destroyOnHidden
      >
        <HistoryChart teeth={teeth} />
      </Modal>
    </>
  );
}
