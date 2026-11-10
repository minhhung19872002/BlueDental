import { useState } from "react";
import { Button, Modal, Tooltip } from "antd";
import {
  DentitionRadio,
  ToothChart,
  dentitionOf,
  type Dentition,
  type ToothPick,
} from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import { LABO_TOOTH_RESULT, laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import "./labo-teeth-chart.css";

const LEGEND = [
  { tone: "worked", label: "Labo:TeethChart:Ordered" },
  { tone: "done", label: "Labo:TeethChart:Passed" },
  { tone: "outside", label: "Labo:TeethChart:Outside" },
] as const;

/** The order's teeth; an order saved before P2910_03 only carries the joined "11, 21". */
function orderTeeth(order: LaboOrderDto): number[] {
  if (order.teeth.length > 0) return order.teeth.map((tooth) => tooth.toothNumber);
  return (order.toothNumbers ?? "")
    .split(/[^0-9]+/)
    .map(Number)
    .filter((fdi) => fdi > 0);
}

const wholeTeeth = (teeth: number[]): ToothPick[] => teeth.map((fdi) => ({ fdi, surfaces: [] }));

/** The dialog's body, rebuilt on every opening so the dentition starts from the order's teeth. */
function OrderChart({ teeth, passed }: { teeth: number[]; passed: number[] }) {
  const picks = wholeTeeth(teeth);
  const [dentition, setDentition] = useState<Dentition>(() => dentitionOf(picks));

  return (
    <>
      <div className="pd-labo-charthead">
        <ul className="pd-labo-chartlegend">
          {LEGEND.map(({ tone, label }) => (
            <li key={tone} className={`pd-labo-chartlegend--${tone}`}>
              {t(label)}
            </li>
          ))}
        </ul>
        <DentitionRadio value={dentition} onChange={setDentition} />
      </div>
      <div className="pd-labo-chart">
        <ToothChart
          value={picks}
          dentition={dentition}
          offeredTeeth={new Set(teeth)}
          doneTeeth={new Set(passed)}
          interaction="view"
        />
      </div>
    </>
  );
}

interface TeethChartProps {
  /** FDI numbers; none and there is no button. */
  teeth: number[];
  /** The ones the check found Đạt, painted green. */
  passed?: number[];
  /** "Sơ đồ răng – LABO-… (răng 11, 21)". */
  code: string;
}

/**
 * A jaw button in place of the tooth numbers (P2910_03), opening the teeth on
 * a chart that is only looked at — the R-1074 history chart's colours, with
 * Đạt teeth green. Shared by the patient's Labo table and the Đặt hàng tab.
 */
export function TeethChartButton({ teeth, passed = [], code }: TeethChartProps) {
  const [open, setOpen] = useState(false);
  if (teeth.length === 0) return <>—</>;

  return (
    <>
      <Tooltip title={t("Labo:TeethChart:View")}>
        <button
          type="button"
          className="pd-labo-chartbtn"
          aria-label={t("Labo:TeethChart:View")}
          onClick={() => setOpen(true)}
        >
          <img src="/img/teeth/teeth.svg" alt="" draggable={false} />
        </button>
      </Tooltip>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        width="min(1024px, calc(100vw - 32px))"
        title={t("Labo:TeethChart:Title", code, teeth.join(", "))}
        footer={<Button onClick={() => setOpen(false)}>{t("Common:Close")}</Button>}
        destroyOnHidden
      >
        <OrderChart teeth={teeth} passed={passed} />
      </Modal>
    </>
  );
}

/** Số răng on the patient's Labo table. */
export function LaboTeethChartButton({ order }: { order: LaboOrderDto }) {
  const passed = order.teeth
    .filter((tooth) => tooth.checkResult === LABO_TOOTH_RESULT.Passed)
    .map((tooth) => tooth.toothNumber);
  return <TeethChartButton teeth={orderTeeth(order)} passed={passed} code={laboOrderNo(order)} />;
}
