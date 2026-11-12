import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import {
  useLaboFinishLineOptions,
  useLaboMaterialOptions,
  useLaboServiceOptions,
  type PickerOption,
} from "@/hooks/useLaboPickers";
import { LABO_CASE_TYPE, laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { toothLabel } from "../order-dialogs/laboToothSpecs";
import { FinishLineChecks } from "./FinishLineChecks";
import { RequestNotes } from "./RequestNotes";
import { RequestSlipInfo } from "./RequestSlipInfo";
import { RequestToothChart } from "./RequestToothChart";
import { chartOrder, type RequestSlipValues } from "./requestSlipModel";
import { pickedNames, restorationGroups, toggleRestoration } from "./restorationGroups";
import { RestorationCard, RestorationHeading } from "./RestorationSections";
import { ShadeZoneMap } from "./ShadeZoneMap";
import type { RestorationCardKind } from "./slipLayout";
import type { RequestSlipStep } from "./useRequestSlipStep";

export interface SlipPartsSetup {
  branchId: string;
  patient: { id: string; code: string; name: string };
  dentists: PickerOption[];
  order: LaboOrderDto | undefined;
  step: RequestSlipStep;
}

/**
 * The parts of the Phiếu yêu cầu, ready to place: the fixed form lays them out
 * its own way, a Mẫu phiếu block by block (F-94). Each takes the heading the
 * template gives it; none keeps its own name.
 */
export interface SlipParts {
  info: (title?: string) => ReactNode;
  restorationHeading: (title?: string) => ReactNode;
  /**
   * One card of Loại phục hình (R-1202). With `emptyTitle`, a card whose group
   * has no material shows that heading over a note; without it, nothing.
   */
  restorationCard: (kind: RestorationCardKind, title?: string, emptyTitle?: string) => ReactNode;
  /** The branch has any material to tick. */
  hasRestorations: boolean;
  shade: (title?: string) => ReactNode;
  teeth: (title?: string) => ReactNode;
  finishLines: (title?: string) => ReactNode;
  notes: (title?: string) => ReactNode;
  /** "Ca mới · R18, R17 · Sứ Lava +1 · Vai 90°" — the footer's one line. */
  summary: string;
}

function summaryOf(values: RequestSlipValues, names: string[], finishes: string[]): string {
  const teeth = chartOrder(values.teeth);
  return [
    t(values.caseType === LABO_CASE_TYPE.Redo ? "Labo:Slip:CaseRedo" : "Labo:Slip:CaseNew"),
    teeth.length ? teeth.map(toothLabel).join(", ") : t("Labo:Slip:NoTeeth"),
    names.length ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : "") : t("Labo:Slip:NoRestoration"),
    ...(finishes.length ? [finishes.join(", ")] : []),
  ].join(" · ");
}

export function useSlipParts({ branchId, patient, dentists, order, step }: SlipPartsSetup): SlipParts {
  const { values, change, editable } = step;
  const services = useLaboServiceOptions(branchId).data ?? [];
  const materials = useLaboMaterialOptions(branchId).data ?? [];
  const finishLines = useLaboFinishLineOptions(branchId).data ?? [];

  const groups = restorationGroups(services, materials, values.restorations);
  const names = pickedNames(groups, values.restorations);
  const finishes = finishLines.filter((line) => values.finishLineIds.includes(line.value)).map((line) => line.label);
  const sectionProps = {
    picked: values.restorations,
    editable,
    onToggle: (pick: RequestSlipValues["restorations"][number]) =>
      change({ restorations: toggleRestoration(values.restorations, pick) }),
  };

  return {
    info: (title) => (
      <RequestSlipInfo
        branchId={branchId}
        patient={patient}
        dentists={dentists}
        values={values}
        editable={editable}
        title={title}
        onChange={change}
      />
    ),
    restorationHeading: (title) => (
      <RestorationHeading title={title ?? t("Labo:Slip:Restoration")} names={names} />
    ),
    restorationCard: (kind, title, emptyTitle) => (
      <RestorationCard kind={kind} groups={groups} title={title} emptyTitle={emptyTitle} {...sectionProps} />
    ),
    hasRestorations: groups.length > 0,
    shade: (title) => (
      <ShadeZoneMap shade={values.shade} editable={editable} title={title} onChange={(shade) => change({ shade })} />
    ),
    teeth: (title) => (
      <RequestToothChart
        branchId={branchId}
        code={order ? laboOrderNo(order) : ""}
        teeth={values.teeth}
        editable={editable}
        priors={step.priors}
        title={title}
        onChange={(teeth) => change({ teeth })}
      />
    ),
    finishLines: (title) => (
      <FinishLineChecks
        options={finishLines}
        value={values.finishLineIds}
        editable={editable}
        title={title}
        onChange={(finishLineIds) => change({ finishLineIds })}
      />
    ),
    notes: (title) => (
      <RequestNotes
        notes={values.notes}
        editable={editable}
        pictures={step.pictures}
        busy={step.saving}
        title={title}
        onChange={(notes) => change({ notes })}
      />
    ),
    summary: summaryOf(values, names, finishes),
  };
}
