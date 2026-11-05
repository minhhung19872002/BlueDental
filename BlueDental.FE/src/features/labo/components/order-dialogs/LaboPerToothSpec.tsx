import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import { toothLabel } from "./laboToothSpecs";
import type { LaboSpecContext } from "./laboSpecContext";
import { LaboShadeInput, LaboSpecLabel, LaboSpecSelect } from "./LaboSpecInputs";

interface Props {
  fdi: string;
  context: LaboSpecContext;
  /** The tooth is "Riêng theo mặt": the surface rows replace the "Mọi mặt" row. */
  surfaceRows: ReactNode | undefined;
  /** The tooth's own Màu is blank. */
  shadeMissing: boolean;
}

/** A tooth's own Kiểu nhịp, then Màu / Đường hoàn tất for every surface or for each one (Riêng thông số). */
export function LaboPerToothSpec({ fdi, context, surfaceRows, shadeMissing }: Props) {
  const { form } = context;
  const field = (name: string) => ["specs", fdi, name];

  return (
    <>
      <div className="pd-lts-field pd-lts-rhythm">
        <LaboSpecLabel>{t("Patient:DentalChart:RhythmType")}</LaboSpecLabel>
        <LaboSpecSelect name={field("rhythmId")} options={form.options.rhythms} disabled={form.readOnly} />
      </div>
      <div className="pd-lts-grid">
        <div className="pd-lts-grid-head">
          <span>{surfaceRows ? t("Labo:Spec:Surface") : ""}</span>
          <LaboSpecLabel required>{t("Labo:Spec:Shade")}</LaboSpecLabel>
          <LaboSpecLabel>{t("Patient:Viewer:CompletedPath")}</LaboSpecLabel>
          <span />
        </div>
        {surfaceRows ?? (
          <div className="pd-lts-srow pd-lts-srow--every">
            <span className="pd-lts-every">{t("Labo:Spec:EverySurface")}</span>
            <LaboShadeInput
              name={field("shade")}
              label={`${t("Patient:DentalChart:ToothColor")} ${toothLabel(fdi)}`}
              error={shadeMissing}
              disabled={form.readOnly}
            />
            <LaboSpecSelect name={field("finishLineId")} options={form.options.finishLines} disabled={form.readOnly} />
            <span />
          </div>
        )}
      </div>
    </>
  );
}
