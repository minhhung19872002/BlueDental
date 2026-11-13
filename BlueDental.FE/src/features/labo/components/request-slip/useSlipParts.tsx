import type { ReactNode } from "react";
import { t } from "@/lib/i18n";
import {
  LABO_TAXONOMY,
  useLaboFinishLineOptions,
  useLaboMaterialOptions,
  useLaboServiceOptions,
  useLaboTaxonomyOptions,
  type PickerOption,
} from "@/hooks/useLaboPickers";
import { LABO_CASE_TYPE, laboOrderNo, type LaboOrderDto } from "@/features/labo/api/laboApi";
import { toothLabel } from "../order-dialogs/laboToothSpecs";
import { FinishLineChecks } from "./FinishLineChecks";
import { RequestNotes } from "./RequestNotes";
import { RequestSlipInfo } from "./RequestSlipInfo";
import { RequestToothChart } from "./RequestToothChart";
import { chartOrder, type RequestSlipValues } from "./requestSlipModel";
import { pickedNames, serviceOfMaterials } from "./restorationChoices";
import { RestorationPicker } from "./RestorationPicker";
import { ShadeZoneMap } from "./ShadeZoneMap";
import { SlipSpecSelects, withHeldOption } from "./SlipSpecSelects";
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
  /** Dịch vụ & vật liệu: one Dịch vụ, then any of its Vật liệu (P1311). */
  restoration: (title?: string) => ReactNode;
  shade: (title?: string) => ReactNode;
  teeth: (title?: string) => ReactNode;
  /** Đường hoàn tất, with Kiểu nhịp and Khớp cắn under it (R-1216). */
  finishLines: (title?: string) => ReactNode;
  notes: (title?: string) => ReactNode;
  /** "Ca mới · R18, R17 · Zirconia +1 · Vai 90°" — the footer's one line. */
  summary: string;
  /** "Toàn sứ · Zirconia, Emax" — the Dịch vụ & vật liệu heading's Đã chọn; empty while none is picked. */
  picked: string;
}

/** "Zirconia +1": the first material picked, and how many more. */
function shortNames(names: string[]): string | undefined {
  if (names.length === 0) return undefined;
  return names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

function summaryOf(values: RequestSlipValues, material: string | undefined, finishes: string[]): string {
  const teeth = chartOrder(values.teeth);
  return [
    t(values.caseType === LABO_CASE_TYPE.Redo ? "Labo:Slip:CaseRedo" : "Labo:Slip:CaseNew"),
    teeth.length ? teeth.map(toothLabel).join(", ") : t("Labo:Slip:NoTeeth"),
    material ?? t("Labo:Slip:NoRestoration"),
    ...(finishes.length ? [finishes.join(", ")] : []),
  ].join(" · ");
}

export function useSlipParts({ branchId, patient, dentists, order, step }: SlipPartsSetup): SlipParts {
  const { values, change, editable } = step;
  const services = useLaboServiceOptions(branchId).data ?? [];
  const materials = useLaboMaterialOptions(branchId).data ?? [];
  const finishLines = useLaboFinishLineOptions(branchId).data ?? [];
  const rhythms = useLaboTaxonomyOptions(LABO_TAXONOMY.rhythm, branchId).data ?? [];
  const bites = useLaboTaxonomyOptions(LABO_TAXONOMY.bite, branchId).data ?? [];

  const names = pickedNames(materials, values.materialIds);
  const serviceId = values.serviceId ?? serviceOfMaterials(materials, values.materialIds);
  const service = services.find((one) => one.value === serviceId)?.label;
  const picked = service ? [service, ...(names.length ? [names.join(", ")] : [])].join(" · ") : "";
  const finishes = finishLines.filter((line) => values.finishLineIds.includes(line.value)).map((line) => line.label);

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
    restoration: (title) => (
      <RestorationPicker
        services={services}
        materials={materials}
        serviceId={values.serviceId}
        materialIds={values.materialIds}
        editable={editable}
        title={title}
        onChange={change}
      />
    ),
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
      >
        <SlipSpecSelects
          rhythms={withHeldOption(rhythms, values.rhythmId, order?.rhythmName)}
          bites={withHeldOption(bites, values.biteId, order?.biteName)}
          rhythmId={values.rhythmId}
          biteId={values.biteId}
          editable={editable}
          onChange={change}
        />
      </FinishLineChecks>
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
    summary: summaryOf(values, shortNames(names), finishes),
    picked,
  };
}
