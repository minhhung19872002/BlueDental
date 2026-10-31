import { useState } from "react";
import { Button, Modal } from "antd";
import { DentitionRadio, ToothChart, dentitionOf, toggleTooth, type Dentition, type ToothPick } from "@/components/ToothChart";
import { t } from "@/lib/i18n";
import "./labo-teeth-chart.css";

interface Props {
  open: boolean;
  /** FDI numbers picked so far. */
  teeth: number[];
  onConfirm: (teeth: number[]) => void;
  onClose: () => void;
}

const wholeTeeth = (teeth: number[]): ToothPick[] => teeth.map((fdi) => ({ fdi, surfaces: [] }));

/** The dialog's body, rebuilt on every opening so it starts from the row's teeth. */
function PickBody({ teeth, onConfirm, onClose }: Omit<Props, "open">) {
  const [picks, setPicks] = useState(() => wholeTeeth(teeth));
  const [dentition, setDentition] = useState<Dentition>(() => dentitionOf(wholeTeeth(teeth)));
  const toggle = (fdi: number) => setPicks((current) => toggleTooth(current, fdi));

  return (
    <>
      <div className="pd-labo-charthead">
        <p className="pd-labo-chartcount">
          {t("Patient:Payment:Quantity")}: <b>{picks.length}</b>
        </p>
        <DentitionRadio value={dentition} onChange={setDentition} />
      </div>
      <div className="pd-labo-chart">
        <ToothChart
          value={picks}
          dentition={dentition}
          interaction="tooth"
          onToggleTooth={toggle}
          onToggleSurface={toggle}
        />
      </div>
      <div className="pd-labo-chartfoot">
        <Button onClick={onClose}>{t("Common:Cancel")}</Button>
        <Button type="primary" onClick={() => onConfirm(picks.map((pick) => pick.fdi).sort((a, b) => a - b))}>
          {t("Treatment:Tooth:ToothPicker")}
        </Button>
      </div>
    </>
  );
}

/**
 * The chart behind the purple tooth button of "Răng *" (P3110 REQ-C6): the
 * doctor adds or drops whole teeth; nothing reaches the form until «Chọn răng».
 * Every tooth is offered — the server takes any valid FDI number, not only the
 * line's (assumption recorded in docs/clone/unknowns.md).
 */
export function LaboTeethPickDialog({ open, ...body }: Props) {
  return (
    <Modal
      open={open}
      onCancel={body.onClose}
      width="min(1024px, calc(100vw - 32px))"
      title={t("Treatment:Tooth:ToothPicker")}
      footer={null}
      destroyOnHidden
    >
      <PickBody {...body} />
    </Modal>
  );
}
