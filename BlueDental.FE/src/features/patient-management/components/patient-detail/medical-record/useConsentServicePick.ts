import { useMemo, useState } from "react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { notifyError } from "@/lib/notify";
import {
  MEDICAL_RECORD_FORM,
  useSetMedicalRecordServices,
  type PatientMedicalRecordDto,
} from "../../../api/medicalRecordApi";
import { useRecordSetSheetFacts, type SheetFactsServiceDto } from "../../../api/medicalRecordSetApi";
import type { MedicalRecordFormSpec } from "../medicalRecordForms";
import { copyLabel } from "../MedicalRecordSheetCard";
import { teethLabel } from "./useSheetFactValues";

/** A service of the set, as the mẫu 5 picker lists it. */
export interface ConsentServiceRow {
  id: string;
  name: string;
  teeth: string;
  planCode: string;
  amount: number;
  /** "Bản NN" of the other live mẫu 5 copies already printing it. */
  heldBy: string[];
}

/** What the picker dialog shows and does — see ConsentServiceDialog. */
export interface ConsentPickDialog {
  open: boolean;
  mode: "add" | "edit";
  rows: ConsentServiceRow[];
  picked: readonly string[];
  loading: boolean;
  saving: boolean;
  onPickedChange: (ids: string[]) => void;
  onSave: () => void;
  onClose: () => void;
}

type PickTarget =
  | { kind: "add"; spec: MedicalRecordFormSpec }
  | { kind: "edit"; sheet: PatientMedicalRecordDto };

interface Options {
  patientId: string;
  setId: string | undefined;
  sheets: readonly PatientMedicalRecordDto[];
  ordinalOf: (sheet: PatientMedicalRecordDto) => number;
  /** Adds the copy with its picks; answers whether it went through. */
  create: (spec: MedicalRecordFormSpec, serviceIds: string[]) => Promise<boolean>;
}

const NO_SERVICES: SheetFactsServiceDto[] = [];

/** The services a copy prints: a copy made before R-1326 prints every one. */
const servicesOfCopy = (sheet: PatientMedicalRecordDto, all: readonly SheetFactsServiceDto[]) =>
  sheet.serviceIds ?? all.map((service) => service.id);

/**
 * Which services a mẫu 5 copy prints (R-1326): picked as the copy is added —
 * the ones no other copy prints yet start ticked — and changed later through
 * "Dịch vụ của phiếu". The pick is stored at once, apart from Lưu.
 */
export function useConsentServicePick({ patientId, setId, sheets, ordinalOf, create }: Options) {
  const facts = useRecordSetSheetFacts(setId);
  const setServices = useSetMedicalRecordServices(patientId);
  const [target, setTarget] = useState<PickTarget | null>(null);
  /** Null until the user ticks something: the defaults then still follow the facts. */
  const [touched, setTouched] = useState<string[] | null>(null);
  const [creating, setCreating] = useState(false);

  const services = facts.data?.services ?? NO_SERVICES;
  const editing = target?.kind === "edit" ? target.sheet : null;

  const rows = useMemo<ConsentServiceRow[]>(() => {
    const planCodes = new Map((facts.data?.plans ?? []).map((plan) => [plan.treatmentPlanId, plan.planCode]));
    const others = sheets.filter(
      (sheet) =>
        sheet.form === MEDICAL_RECORD_FORM.TreatmentConsent && !sheet.cancelledAt && sheet.id !== editing?.id,
    );
    return services.map((service) => ({
      id: service.id,
      name: service.serviceName,
      teeth: teethLabel(service.toothCodes),
      planCode: planCodes.get(service.treatmentPlanId) ?? "",
      amount: service.amount,
      heldBy: others
        .filter((sheet) => servicesOfCopy(sheet, services).includes(service.id))
        .map((sheet) => copyLabel(ordinalOf(sheet))),
    }));
  }, [facts.data?.plans, services, sheets, editing?.id, ordinalOf]);

  const defaults = editing
    ? servicesOfCopy(editing, services)
    : rows.filter((row) => row.heldBy.length === 0).map((row) => row.id);
  const picked = touched ?? defaults;

  const openFor = (next: PickTarget) => {
    setTouched(null);
    setTarget(next);
  };
  const close = () => setTarget(null);

  const save = async () => {
    if (!target) return;
    const ids = [...picked];
    if (target.kind === "add") {
      setCreating(true);
      const added = await create(target.spec, ids).finally(() => setCreating(false));
      if (added) close();
      return;
    }
    try {
      await setServices.mutateAsync({ id: target.sheet.id, serviceIds: ids });
      toast.success(t("Patient:MedRecord:ConsentServicesSaved"));
      close();
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const dialog: ConsentPickDialog = {
    open: target !== null,
    mode: target?.kind ?? "add",
    rows,
    picked,
    loading: facts.isLoading,
    saving: creating || setServices.isPending,
    onPickedChange: setTouched,
    onSave: () => void save(),
    onClose: close,
  };

  return {
    openAdd: (spec: MedicalRecordFormSpec) => openFor({ kind: "add", spec }),
    openEdit: (sheet: PatientMedicalRecordDto) => openFor({ kind: "edit", sheet }),
    dialog,
  };
}
