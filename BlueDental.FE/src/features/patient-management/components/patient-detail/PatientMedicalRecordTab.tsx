import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Spin, Tooltip } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Maximize2, Minimize2, Minus, Plus, Printer, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { AppDialog } from "@/components/AppDialog";
import { useAbility } from "@/hooks/useAbility";
import { extractApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { t } from "@/lib/i18n";
import { copiedPicturesReady, copySheetsForPrint, framesForSheets } from "./medical-record/printing";
import {
  useAddMedicalRecord,
  useCancelMedicalRecord,
  usePatientMedicalRecords,
  useRenameMedicalRecord,
  useSaveMedicalRecord,
  type PatientMedicalRecordDto,
} from "../../api/medicalRecordApi";
import type { RecordSetDto } from "../../api/medicalRecordSetApi";
import type { PatientDto } from "../../types/patient";
import { MedicalRecordIndex } from "./MedicalRecordIndex";
import { copyLabel, sheetTime } from "./MedicalRecordSheetCard";
import { MedicalRecordSheetView } from "./MedicalRecordSheetView";
import { CancelSheetDialog } from "./medical-record-set/CancelSheetDialog";
import { RecordSetDialogs } from "./medical-record-set/RecordSetDialogs";
import { RecordSetEmptyState } from "./medical-record-set/RecordSetEmptyState";
import { RecordSetPicker } from "./medical-record-set/RecordSetPicker";
import { isCancelledSet } from "./medical-record-set/recordSetView";
import { useRecordSetWorkflow } from "./medical-record-set/useRecordSetWorkflow";
import "./medical-record-set/record-set.css";
import { MedicalRecordCanvasHead } from "./medical-record/MedicalRecordCanvasHead";
import { PrintSheetPicker } from "./medical-record/PrintSheetPicker";
import { useSheetFieldValues } from "./medical-record/useSheetFieldValues";
import { useSheetDiagnoses } from "./medical-record/useSheetDiagnoses";
import { useSheetFactValues } from "./medical-record/useSheetFactValues";
import { useSheetFullscreen } from "./medical-record/useSheetFullscreen";
import { useUnsavedSheets } from "./medical-record/useUnsavedSheets";
import { UnsavedSheetDialog } from "./medical-record/UnsavedSheetDialog";
import { diagnosisFieldValues, type FieldValues } from "./medical-record/fieldValues";
import { MEDICAL_RECORD_FORMS, formSpecOf, type MedicalRecordFormSpec } from "./medicalRecordForms";
import { parseFieldValues, serialiseFieldValues } from "./medicalRecordDraft";
import "./medical-record/medical-record.css";

/**
 * Bệnh án — the second view behind the header's Chi tiết hồ sơ / Bệnh án switch.
 *
 * "Mục lục bệnh án" on the left adds a sheet and lists the ones already made,
 * nested under the form each came from; the canvas on the right shows the one
 * being worked on, and the bar along the bottom carries the view mode, the
 * zoom, printing and the save. Measured on staging 2026-09-09; see
 * docs/clone/pages/patient-detail.md §Bệnh án.
 */

/** 60%–140% in tens, as measured on the reference. */
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.4;

type ViewMode = "single" | "all";

/** Where the two columns fold into one — the reference's own breakpoint. */
const TWO_COLUMN_QUERY = "(min-width: 1025px)";

interface TabProps {
  patientId: string;
  /** Printed onto the sheets that carry the patient's identity. */
  patient?: PatientDto;
}

export function PatientMedicalRecordTab({ patientId, patient }: TabProps) {
  const ability = useAbility("patientMedicalRecord");
  const branchId = useCurrentBranchId();
  const query = usePatientMedicalRecords(patientId);
  const addSheet = useAddMedicalRecord(patientId);
  const saveSheet = useSaveMedicalRecord(patientId);
  const renameSheet = useRenameMedicalRecord(patientId);
  const cancelSheet = useCancelMedicalRecord(patientId);
  const recordSets = useRecordSetWorkflow(patientId);
  const activeSet = recordSets.active;
  /** A cancelled set is shown, read-only: nothing in it changes any more. */
  const setLocked = activeSet ? isCancelledSet(activeSet) : false;

  /*
   * In the index's own order: by form, then by when each copy was made. The
   * API answers in its own order, and the sheet that opens by default is the
   * first card — so the two have to agree.
   */
  /*
   * Lengthening or shortening a printed form is a clinic administrator's call,
   * as it is on the reference — a treatment log with a block removed is a
   * different document.
   */
  const mayEditRows = useAuthStore((state) =>
    (state.user?.roles ?? []).some((role) => /admin/i.test(role)),
  );

  /** The forms the open set shows in its index ("Mục hiển thị"). */
  const forms = useMemo(
    () => MEDICAL_RECORD_FORMS.filter((spec) => activeSet?.visibleForms.includes(spec.form)),
    [activeSet],
  );

  /** The open set's sheets, of the forms it shows. */
  const sheets = useMemo(() => {
    const order = new Map(forms.map((spec, at) => [spec.form, at]));
    const own = (query.data?.items ?? []).filter(
      (sheet) => sheet.recordSetId === activeSet?.id && order.has(sheet.form),
    );
    return own.sort(
      (a, b) =>
        (order.get(a.form) ?? 0) - (order.get(b.form) ?? 0) ||
        a.creationTime.localeCompare(b.creationTime),
    );
  }, [query.data, forms, activeSet?.id]);
  const auto = useSheetFieldValues(patient, branchId);
  const diagnosesFrom = useSheetDiagnoses(patientId, branchId);
  /** What the open set's treatment slips answer (save/P1810.drawio). */
  const factValues = useSheetFactValues(activeSet?.id);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("single");
  const [zoom, setZoom] = useState(1);
  const fullscreen = useSheetFullscreen();
  /*
   * The index is open beside the sheet while there are two columns, and closed
   * to its header once they fold — there is no room for both, which is what the
   * reference does. Opening or closing it by hand still wins until the window
   * crosses the breakpoint again.
   */
  const [collapsed, setCollapsed] = useState(
    () => !window.matchMedia(TWO_COLUMN_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(TWO_COLUMN_QUERY);
    const follow = (event: MediaQueryListEvent) => setCollapsed(!event.matches);
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, []);
  /**
   * Set when a sheet is opened from the index while the columns are folded.
   *
   * The reveal cannot happen in the click handler: the index folds in the same
   * render, and scrolling before that lands on where the sheet *was* — a screen
   * and a half further down. Waiting for the commit means the layout is already
   * the folded one.
   */
  const [revealing, setRevealing] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!revealing) return;
    setRevealing(false);
    canvas.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [revealing]);

  /**
   * What has been written on a sheet but not saved yet, per sheet.
   *
   * Held here rather than seeded into state by an effect: the sheet is built
   * from its values during the same render it first appears in, and an effect
   * would run a beat too late — the page would be drawn blank and then never
   * rebuilt, because rebuilding it as someone types would take the caret.
   */
  const [edits, setEdits] = useState<Record<string, FieldValues>>({});
  const [cancelling, setCancelling] = useState<PatientMedicalRecordDto | null>(null);
  const [renaming, setRenaming] = useState<PatientMedicalRecordDto | null>(null);
  const [newTitle, setNewTitle] = useState("");
  /** The day each dated sheet is filled in for, until it is saved onto the sheet. */
  const [dates, setDates] = useState<Record<string, Dayjs>>({});

  const active = sheets.find((sheet) => sheet.id === activeId) ?? sheets[0] ?? null;
  /** A cancelled sheet, or any sheet of a cancelled set, is only read and printed. */
  const readOnly = (sheet: PatientMedicalRecordDto) => setLocked || Boolean(sheet.cancelledAt);
  const readOnlyNotice = (sheet: PatientMedicalRecordDto) => {
    if (setLocked) return t("Patient:RecordSet:CancelledReadOnly");
    return sheet.cancelledAt ? t("Patient:MedRecord:CancelledReadOnly") : undefined;
  };

  /** A sheet reads as what is being written on it, or as the saved copy. */
  const valuesOf = (sheet: PatientMedicalRecordDto): FieldValues =>
    edits[sheet.id] ?? parseFieldValues(sheet.content);

  /**
   * The day a dated sheet is filled in for: what has been picked, else what is
   * already printed on it, else today.
   */
  const dateOf = (sheet: PatientMedicalRecordDto): Dayjs => {
    const picked = dates[sheet.id];
    if (picked) return picked;

    const [key] = formSpecOf(sheet.form).dateFieldKeys ?? [];
    // What the sheet holds, else what the set's slips say — Ngày tư vấn.
    const printed = key ? (valuesOf(sheet)[key] ?? factValues[key]) : undefined;
    if (typeof printed === "string" && printed) {
      const parsed = dayjs(printed, "DD/MM/YYYY", true);
      if (parsed.isValid()) return parsed;
    }
    return dayjs();
  };

  /**
   * What a sheet's blanks fall back to: the record and the letterhead, the
   * patient's diagnoses — on a dated form, those from the sheet's own day on —
   * what the set's slips answer, and the day picked above the sheet in the
   * blanks that print it (Ngày thực hiện, P1810).
   */
  const autoOf = (sheet: PatientMedicalRecordDto): FieldValues => {
    const spec = formSpecOf(sheet.form);
    const day = spec.dateLabel ? dateOf(sheet) : undefined;
    const printedDay = day?.format("DD/MM/YYYY");
    const dated = printedDay
      ? Object.fromEntries((spec.dateFieldKeys ?? []).map((key) => [key, printedDay]))
      : {};
    return { ...auto, ...diagnosisFieldValues(diagnosesFrom(day)), ...factValues, ...dated };
  };

  /** Writes a value picked outside the sheet into the blanks that print it. */
  const writeOnSheet = (sheet: PatientMedicalRecordDto, keys: readonly string[], printed: string) => {
    if (keys.length === 0) return;
    setEdits((current) => {
      const values = { ...(current[sheet.id] ?? parseFieldValues(sheet.content)) };
      for (const key of keys) values[key] = printed;
      return { ...current, [sheet.id]: values };
    });
  };

  /** Picking the day writes it into whichever blanks the form prints it in. */
  const handleDateChange = (sheet: PatientMedicalRecordDto, next: Dayjs | null) => {
    if (!next) return;
    setDates((current) => ({ ...current, [sheet.id]: next }));
    writeOnSheet(sheet, formSpecOf(sheet.form).dateFieldKeys ?? [], next.format("DD/MM/YYYY"));
  };

  /** `Bản NN` for a sheet: its position among the sheets of its own form. */
  const ordinalOf = (sheet: PatientMedicalRecordDto) =>
    sheets.filter((item) => item.form === sheet.form).findIndex((item) => item.id === sheet.id) + 1;

  /**
   * Opening a sheet from the index.
   *
   * With one column the index sits *above* the sheet and is a window tall, so
   * the sheet that just opened is off the bottom of the screen — picking a card
   * looked like it did nothing at all. The list folds away, as it does when the
   * window crosses the breakpoint, and the sheet is brought up. With two
   * columns both are already in view and the list stays as the user left it.
   */
  const showSheet = (id: string) => {
    setActiveId(id);
    if (window.matchMedia(TWO_COLUMN_QUERY).matches) return;
    setCollapsed(true);
    setRevealing(true);
  };

  /** Another sheet is opened only once the open one's unsaved writing is answered for. */
  const openSheet = (id: string) => {
    if (id === active?.id) return showSheet(id);
    unsaved.ask(() => showSheet(id), active ? [active.id] : []);
  };

  /** Switching set leaves the open sheet, so its unsaved writing is answered for first. */
  const handleSelectSet = (set: RecordSetDto) => {
    if (set.id === activeSet?.id) return;
    unsaved.ask(() => {
      recordSets.select(set);
      setActiveId(null);
    }, active ? [active.id] : []);
  };

  const handleAdd = async (spec: MedicalRecordFormSpec) => {
    if (!activeSet) return;
    try {
      const created = await addSheet.mutateAsync({ recordSetId: activeSet.id, form: spec.form, title: spec.label });
      openSheet(created.id);
      toast.success(t("Patient:MedRecord:Added"));
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  /** Saves what is written on one sheet; answers whether it went through. */
  const saveSheetEdits = async (sheet: PatientMedicalRecordDto): Promise<boolean> => {
    try {
      await saveSheet.mutateAsync({
        id: sheet.id,
        content: serialiseFieldValues(valuesOf(sheet)),
      });
      setEdits((current) => {
        const rest = { ...current };
        delete rest[sheet.id];
        return rest;
      });
      toast.success(t("Patient:MedRecord:Saved"));
      return true;
    } catch (error) {
      notifyError(extractApiError(error));
      return false;
    }
  };

  const handleSave = async () => {
    if (active) await saveSheetEdits(active);
  };

  const unsaved = useUnsavedSheets({
    sheets,
    edits,
    save: saveSheetEdits,
    discard: (ids) =>
      setEdits((current) => {
        const rest = { ...current };
        for (const id of ids) delete rest[id];
        return rest;
      }),
  });

  const handleRename = async () => {
    if (!renaming) return;
    try {
      await renameSheet.mutateAsync({ id: renaming.id, title: newTitle.trim() });
      setRenaming(null);
      toast.success(t("Patient:MedRecord:Renamed"));
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  /** "Hủy phiếu": kept, marked Đã hủy; what was being written on it is dropped. */
  const handleCancelSheet = async (reason: string) => {
    if (!cancelling) return;
    try {
      await cancelSheet.mutateAsync({ id: cancelling.id, reason });
      setEdits((current) => {
        const rest = { ...current };
        delete rest[cancelling.id];
        return rest;
      });
      setCancelling(null);
      toast.success(t("Patient:MedRecord:CancelledToast"));
    } catch (error) {
      notifyError(extractApiError(error));
    }
  };

  const shown = mode === "all" ? sheets : active ? [active] : [];

  const restorePage = useRef<(() => void) | null>(null);

  const printSheets = async (ids: readonly string[]) => {
    if (!ids.length) return;
    const frames = await framesForSheets(ids);
    if (!frames.length) return;

    restorePage.current?.();
    restorePage.current = copySheetsForPrint(frames);
    await copiedPicturesReady();
    window.print();
  };

  useEffect(() => {
    const done = () => {
      restorePage.current?.();
      restorePage.current = null;
    };
    window.addEventListener("afterprint", done);
    return () => {
      window.removeEventListener("afterprint", done);
      done();
    };
  }, []);

  const patientLabel = patient ? `[${patient.patientCode}] ${patient.fullName}` : "";
  const setDialogs = <RecordSetDialogs workflow={recordSets} patientLabel={patientLabel} />;

  if (recordSets.loading) {
    return (
      <section className="pd-pane pd-pane--fill rs-loading">
        <Spin />
      </section>
    );
  }

  // No set at all yet: the slips to open the first one from.
  if (!activeSet) {
    return (
      <>
        <RecordSetEmptyState
          freeSlips={recordSets.freeSlips}
          loading={recordSets.plansLoading}
          onCreate={ability.canCreate ? recordSets.openCreate : undefined}
        />
        {setDialogs}
      </>
    );
  }

  const indexHead = (
    <div className="rs-index-head">
      <RecordSetPicker
        sets={recordSets.sets}
        active={activeSet}
        freeSlipCount={recordSets.freeSlips.length}
        onSelect={handleSelectSet}
        onCreate={ability.canCreate ? () => recordSets.openCreate() : undefined}
        onEdit={ability.canUpdate ? recordSets.openEdit : undefined}
        onCancel={ability.canDelete ? recordSets.askCancel : undefined}
      />
    </div>
  );

  return (
    <section className="pd-pane pd-pane--fill pd-medical">
      <div className={["pd-medical-grid", collapsed && "pd-medical-grid--collapsed"].filter(Boolean).join(" ")}>
        <MedicalRecordIndex
          head={indexHead}
          forms={forms}
          sheets={sheets}
          activeId={active?.id ?? null}
          collapsed={collapsed}
          adding={addSheet.isPending}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onAdd={ability.canCreate && !setLocked ? (spec) => void handleAdd(spec) : undefined}
          actions={{
            onSelect: (sheet) => openSheet(sheet.id),
            onPrint: (sheet) => {
              setActiveId(sheet.id);
              setMode("single");
              void printSheets([sheet.id]);
            },
            onRename:
              ability.canUpdate && !setLocked
                ? (sheet) => {
                    setRenaming(sheet);
                    setNewTitle(sheet.title);
                  }
                : undefined,
            onCancel: ability.canDelete && !setLocked ? setCancelling : undefined,
          }}
        />

        <div
          className={["pd-medical-canvas", fullscreen.fullscreen && "pd-medical-canvas--fullscreen"]
            .filter(Boolean)
            .join(" ")}
          ref={canvas}
        >
          <div className="pd-medical-canvas-scroll">
            {active && (
              <MedicalRecordCanvasHead
                ordinal={ordinalOf(active)}
                title={active.title}
                dateLabel={formSpecOf(active.form).dateLabel}
                date={dateOf(active)}
                onDateChange={readOnly(active) ? undefined : (next) => handleDateChange(active, next)}
                notice={readOnlyNotice(active)}
              />
            )}

            <div className="pd-medical-paper">
              {shown.length === 0 ? (
                <p className="pd-medical-empty">
                  {t("Patient:MedRecord:EmptyHint")}
                </p>
              ) : (
                shown.map((sheet) => (
                  <MedicalRecordSheetView
                    key={sheet.id}
                    sheet={sheet}
                    auto={autoOf(sheet)}
                    zoom={zoom}
                    editable={mode === "single" && sheet.id === active?.id && !readOnly(sheet)}
                    values={valuesOf(sheet)}
                    mayEditRows={mayEditRows}
                    onChange={(next) => setEdits((current) => ({ ...current, [sheet.id]: next }))}
                  />
                ))
              )}
            </div>
          </div>
          <div className="pd-medical-barwrap">
            <div className="pd-medical-bar">
              <SegmentedTabs
                items={[
                  { key: "single" as const, label: t("Patient:Payment:EachSlip") },
                  { key: "all" as const, label: t("Patient:Misc:All") },
                ]}
                activeKey={mode}
                onChange={setMode}
              />

              <div className="pd-medical-zoom">
                <span>{t("Zoom")}</span>
                <Button
                  aria-label={t("Patient:MedRecord:ZoomOut")}
                  title={t("Patient:Viewer:ZoomOut")}
                  icon={<Minus size={14} />}
                  disabled={zoom <= ZOOM_MIN}
                  onClick={() =>
                    setZoom((value) => Math.max(ZOOM_MIN, Number((value - ZOOM_STEP).toFixed(1))))
                  }
                />
                <b>{Math.round(zoom * 100)}%</b>
                <Button
                  aria-label={t("Patient:MedRecord:ZoomIn")}
                  title={t("Patient:Viewer:ZoomIn")}
                  icon={<Plus size={14} />}
                  disabled={zoom >= ZOOM_MAX}
                  onClick={() =>
                    setZoom((value) => Math.min(ZOOM_MAX, Number((value + ZOOM_STEP).toFixed(1))))
                  }
                />
              </div>

              <Tooltip
                title={t(fullscreen.fullscreen ? "Patient:MedRecord:ExitFullscreen" : "Patient:MedRecord:Fullscreen")}
              >
                <Button
                  aria-label={t(
                    fullscreen.fullscreen ? "Patient:MedRecord:ExitFullscreen" : "Patient:MedRecord:Fullscreen",
                  )}
                  aria-pressed={fullscreen.fullscreen}
                  icon={fullscreen.fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  onClick={fullscreen.toggle}
                />
              </Tooltip>

              {mode === "all" ? (
                <PrintSheetPicker
                  sheets={sheets}
                  ordinalOf={ordinalOf}
                  onPrint={(ids) => void printSheets(ids)}
                />
              ) : (
                <Button
                  icon={<Printer size={14} />}
                  disabled={!active}
                  onClick={() => active && void printSheets([active.id])}
                >
                  {t("Patient:MedRecord:Print")}
                </Button>
              )}

              <Button className="pd-medical-sync" icon={<RefreshCw size={14} />} disabled>
                {t("Patient:MedRecord:SyncSlip")}
              </Button>

              <Button
                type="primary"
                icon={<Save size={14} />}
                loading={saveSheet.isPending}
                disabled={!active || !formSpecOf(active.form).fillable || readOnly(active)}
                onClick={() => void handleSave()}
              >
                {saveSheet.isPending ? t("Patient:MedicalRecord:Saving") : t("Patient:Misc:Save")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AppDialog
        open={Boolean(renaming)}
        title={t("Patient:MedRecord:Rename")}
        width={420}
        canSave={newTitle.trim().length > 0}
        saving={renameSheet.isPending}
        cancelLabel={t("Patient:Misc:CancelVN")}
        onSave={() => void handleRename()}
        onClose={() => setRenaming(null)}
      >
        <Input
          autoFocus
          value={newTitle}
          aria-label={t("Patient:MedRecord:SlipName")}
          onChange={(event) => setNewTitle(event.target.value)}
          onPressEnter={() => void handleRename()}
        />
      </AppDialog>

      <UnsavedSheetDialog {...unsaved.dialog} />

      {cancelling && (
        <CancelSheetDialog
          subtitle={t(
            "Patient:MedRecord:CancelSubtitle",
            cancelling.title,
            copyLabel(ordinalOf(cancelling)),
            sheetTime(cancelling.creationTime),
          )}
          pending={cancelSheet.isPending}
          onConfirm={(reason) => void handleCancelSheet(reason)}
          onClose={() => setCancelling(null)}
        />
      )}

      {setDialogs}
    </section>
  );
}
