import { t } from "@/lib/i18n";
import { sharedSummary } from "./laboSpecRules";
import { SHARED_ROW, sharesShade, toothLabel } from "./laboToothSpecs";
import type { LaboSpecContext } from "./laboSpecContext";
import { LaboSpecCardHead } from "./LaboSpecCardHead";
import { LaboShadeInput, LaboSpecLabel, LaboSpecSelect } from "./LaboSpecInputs";

interface Props {
  context: LaboSpecContext;
  open: boolean;
  onToggle: () => void;
}

/**
 * The "Tất cả" card, while Thông số răng is Chung: Màu răng (or "Riêng từng
 * răng ↓" when each tooth keeps its own), Đường hoàn tất and Kiểu nhịp,
 * typed once for every tooth.
 */
export function LaboSharedSpecCard({ context, open, onToggle }: Props) {
  const { form, mode, rows, names, teeth } = context;
  const errors = context.errors.filter((error) => error.row === SHARED_ROW);
  const title = t("Labo:Spec:All");
  const field = (name: string) => ["specs", SHARED_ROW, name];
  const className = ["pd-lts-card", "pd-lts-card--all", errors.length > 0 && "pd-lts-card--error"]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={className} data-tooth={SHARED_ROW}>
      <LaboSpecCardHead
        title={title}
        caption={t("Labo:Spec:AllCaption", teeth.map(toothLabel).join(", "))}
        summary={sharedSummary(mode, rows, names)}
        errors={errors.length}
        open={open}
        onToggle={onToggle}
      />
      {open && (
        <div className="pd-lts-body pd-lts-shared">
          <div className="pd-lts-field">
            <LaboSpecLabel required>{t("Patient:DentalChart:ToothColor")}</LaboSpecLabel>
            {sharesShade(mode) ? (
              <LaboShadeInput
                name={field("shade")}
                label={`${t("Patient:DentalChart:ToothColor")} ${title}`}
                error={errors.length > 0}
                disabled={form.readOnly}
              />
            ) : (
              <span className="pd-lts-fixed">{t("Labo:Spec:EachToothBelow")}</span>
            )}
          </div>
          <div className="pd-lts-field">
            <LaboSpecLabel>{t("Patient:Viewer:CompletedPath")}</LaboSpecLabel>
            <LaboSpecSelect name={field("finishLineId")} options={form.options.finishLines} disabled={form.readOnly} />
          </div>
          <div className="pd-lts-field">
            <LaboSpecLabel>{t("Patient:DentalChart:RhythmType")}</LaboSpecLabel>
            <LaboSpecSelect name={field("rhythmId")} options={form.options.rhythms} disabled={form.readOnly} />
          </div>
        </div>
      )}
    </article>
  );
}
