import { useState } from "react";
import { t } from "@/lib/i18n";
import type { LaboSpecMode } from "@/features/labo/api/laboApi";
import type { LaboPriorTeeth } from "./laboPriorTeeth";
import { switchedRows } from "./laboSpecEdits";
import { SHARED_ROW, sharesParams } from "./laboToothSpecs";
import { useLaboSpecContext } from "./laboSpecContext";
import { LaboSharedSpecCard } from "./LaboSharedSpecCard";
import { LaboSpecModeBar } from "./LaboSpecModeBar";
import { LaboToothSpecCard } from "./LaboToothSpecCard";
import type { LaboOrderForm } from "./useLaboOrderForm";
import "./labo-tooth-spec.css";

interface Props {
  form: LaboOrderForm;
  /** The teeth already on another order of the slip; their cards wear the orange dot. */
  priors: LaboPriorTeeth;
}

/**
 * Thông số từng răng on the Đặt hàng tab (Labo v2 mock, R-1150): the two
 * Chung / Riêng switches, the "Tất cả" card while the parameters are shared,
 * then one card per tooth with its Mặt răng picked on a drawn tooth. Every
 * card folds, and reads "n lỗi" until it lacks nothing (REQ-C9).
 */
export function LaboToothSpecTable({ form, priors }: Props) {
  const context = useLaboSpecContext(form);
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const { teeth, mode } = context;
  if (teeth.length === 0) return null;

  const shared = sharesParams(mode);
  const keys = shared ? [SHARED_ROW, ...teeth] : teeth;
  const anyOpen = keys.some((key) => !closed.has(key));

  const handleToggle = (key: string) =>
    setClosed((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const handleToggleAll = () => setClosed(anyOpen ? new Set(keys) : new Set());
  const handleMode = (next: LaboSpecMode) => {
    form.form.setFieldValue("specs", switchedRows(context.rows, teeth, mode, next));
    form.form.setFieldValue("specMode", next);
  };

  return (
    <section className="pd-lts" aria-label={t("Labo:Spec:Title")}>
      <header className="pd-lts-header">
        <h4>{t("Labo:Spec:Title")}</h4>
        <p>{t("Labo:Spec:Hint")}</p>
      </header>
      <LaboSpecModeBar mode={mode} disabled={form.readOnly} onChange={handleMode} />
      <div className="pd-lts-count">
        <span>{t(shared ? "Labo:Spec:GroupCountShared" : "Labo:Spec:GroupCount", teeth.length)}</span>
        <button type="button" className="pd-lts-foldall" onClick={handleToggleAll}>
          {t(anyOpen ? "Labo:Spec:CollapseAll" : "Labo:Spec:ExpandAll")}
        </button>
      </div>
      <div className="pd-lts-cards">
        {shared && (
          <LaboSharedSpecCard
            context={context}
            open={!closed.has(SHARED_ROW)}
            onToggle={() => handleToggle(SHARED_ROW)}
          />
        )}
        {teeth.map((fdi) => (
          <LaboToothSpecCard
            key={fdi}
            fdi={fdi}
            context={context}
            prior={priors.has(fdi)}
            open={!closed.has(fdi)}
            onToggle={handleToggle}
          />
        ))}
      </div>
    </section>
  );
}
