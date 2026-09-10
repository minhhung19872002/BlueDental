import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Minus, Plus, Printer, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { AppDialog } from "@/components/AppDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useAuthStore } from "@/features/auth/store/authStore";
import { t } from "@/lib/i18n";
import { isolateSheetsForPrint } from "./medical-record/printing";
import {
  useAddMedicalRecord,
  useDeleteMedicalRecord,
  usePatientMedicalRecords,
  useRenameMedicalRecord,
  useSaveMedicalRecord,
  type PatientMedicalRecordDto,
} from "../../api/medicalRecordApi";
import type { PatientDto } from "../../types/patient";
import { MedicalRecordIndex } from "./MedicalRecordIndex";
import { MedicalRecordSheetView } from "./MedicalRecordSheetView";
import { MedicalRecordCanvasHead } from "./medical-record/MedicalRecordCanvasHead";
import { PrintSheetPicker } from "./medical-record/PrintSheetPicker";
import { useSheetFieldValues } from "./medical-record/useSheetFieldValues";
import type { FieldValues } from "./medical-record/fieldValues";
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
  const branchId = useCurrentBranchId();
  const query = usePatientMedicalRecords(patientId);
  const addSheet = useAddMedicalRecord(patientId);
  const saveSheet = useSaveMedicalRecord(patientId);
  const renameSheet = useRenameMedicalRecord(patientId);
  const deleteSheet = useDeleteMedicalRecord(patientId);

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

  const sheets = useMemo(() => {
    const order = new Map(MEDICAL_RECORD_FORMS.map((spec, at) => [spec.form, at]));
    return [...(query.data?.items ?? [])].sort(
      (a, b) =>
        (order.get(a.form) ?? 0) - (order.get(b.form) ?? 0) ||
        a.creationTime.localeCompare(b.creationTime),
    );
  }, [query.data]);
  const auto = useSheetFieldValues(patient, branchId);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("single");
  const [zoom, setZoom] = useState(1);
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

  const [stampedIds, setStampedIds] = useState<ReadonlySet<string>>(new Set());
  /**
   * What has been written on a sheet but not saved yet, per sheet.
   *
   * Held here rather than seeded into state by an effect: the sheet is built
   * from its values during the same render it first appears in, and an effect
   * would run a beat too late — the page would be drawn blank and then never
   * rebuilt, because rebuilding it as someone types would take the caret.
   */
  const [edits, setEdits] = useState<Record<string, FieldValues>>({});
  const [removing, setRemoving] = useState<PatientMedicalRecordDto | null>(null);
  const [renaming, setRenaming] = useState<PatientMedicalRecordDto | null>(null);
  const [newTitle, setNewTitle] = useState("");
  /** The day each dated sheet is filled in for, until it is saved onto the sheet. */
  const [dates, setDates] = useState<Record<string, Dayjs>>({});

  const active = sheets.find((sheet) => sheet.id === activeId) ?? sheets[0] ?? null;

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
    const printed = key ? valuesOf(sheet)[key] : undefined;
    if (typeof printed === "string" && printed) {
      const parsed = dayjs(printed, "DD/MM/YYYY", true);
      if (parsed.isValid()) return parsed;
    }
    return dayjs();
  };

  /** Picking the day writes it into whichever blanks the form prints it in. */
  const handleDateChange = (sheet: PatientMedicalRecordDto, next: Dayjs | null) => {
    if (!next) return;
    setDates((current) => ({ ...current, [sheet.id]: next }));

    const keys = formSpecOf(sheet.form).dateFieldKeys ?? [];
    if (keys.length === 0) return;

    const printed = next.format("DD/MM/YYYY");
    setEdits((current) => {
      const values = { ...(current[sheet.id] ?? parseFieldValues(sheet.content)) };
      for (const key of keys) values[key] = printed;
      return { ...current, [sheet.id]: values };
    });
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
  const openSheet = (id: string) => {
    setActiveId(id);
    if (window.matchMedia(TWO_COLUMN_QUERY).matches) return;
    setCollapsed(true);
    setRevealing(true);
  };

  const handleAdd = async (spec: MedicalRecordFormSpec) => {
    try {
      const created = await addSheet.mutateAsync({ form: spec.form, title: t(spec.label) });
      // A new sheet opens on the canvas, so it needs the same reveal — a copy
      // you cannot see is the same thing as one you cannot pick.
      openSheet(created.id);
      toast.success(t("Đã thêm phiếu bệnh án"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleSave = async () => {
    if (!active) return;
    try {
      await saveSheet.mutateAsync({
        id: active.id,
        content: serialiseFieldValues(valuesOf(active)),
      });
      // The saved copy is the truth again; the draft has nothing left to add.
      setEdits((current) => {
        const rest = { ...current };
        delete rest[active.id];
        return rest;
      });
      toast.success(t("Đã lưu phiếu bệnh án"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleRename = async () => {
    if (!renaming) return;
    try {
      await renameSheet.mutateAsync({ id: renaming.id, title: newTitle.trim() });
      setRenaming(null);
      toast.success(t("Đã đổi tên phiếu"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleDelete = async () => {
    if (!removing) return;
    try {
      await deleteSheet.mutateAsync(removing.id);
      if (activeId === removing.id) setActiveId(null);
      setRemoving(null);
      toast.success(t("Đã xoá phiếu bệnh án"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  /** The tick on a card marks the sheet as one that carries the clinic's stamp. */
  const handleStamp = (sheet: PatientMedicalRecordDto, stamped: boolean) => {
    setStampedIds((current) => {
      const next = new Set(current);
      if (stamped) next.add(sheet.id);
      else next.delete(sheet.id);
      return next;
    });
  };

  const shown = mode === "all" ? sheets : active ? [active] : [];

  // Set while a print is in flight, so `afterprint` can put the page back.
  const restorePage = useRef<(() => void) | null>(null);

  const printSheets = (ids: readonly string[]) => {
    if (!ids.length) return;
    restorePage.current?.();
    restorePage.current = isolateSheetsForPrint();
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

  return (
    <section className="pd-pane pd-pane--fill pd-medical">
      <div className="pd-medical-grid">
        <MedicalRecordIndex
          sheets={sheets}
          activeId={active?.id ?? null}
          stampedIds={stampedIds}
          collapsed={collapsed}
          adding={addSheet.isPending}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onAdd={(spec) => void handleAdd(spec)}
          onSelect={(sheet) => openSheet(sheet.id)}
          onStamp={handleStamp}
          onPrint={(sheet) => {
            setActiveId(sheet.id);
            setMode("single");
            printSheets([sheet.id]);
          }}
          onRename={(sheet) => {
            setRenaming(sheet);
            setNewTitle(sheet.title);
          }}
          onDelete={(sheet) => setRemoving(sheet)}
        />

        <div className="pd-medical-canvas" ref={canvas}>
          {/* The scroller sits inside the column rather than being it: the bar
              below floats over the column and must not scroll away with the
              sheet, and the head above must stay put while the paper moves.
              Both are how the reference nests it. */}
          <div className="pd-medical-canvas-scroll">
            {active && (
              <MedicalRecordCanvasHead
                ordinal={ordinalOf(active)}
                title={active.title}
                dateLabel={formSpecOf(active.form).dateLabel}
                date={dateOf(active)}
                onDateChange={(next) => handleDateChange(active, next)}
              />
            )}

            <div className="pd-medical-paper">
              {shown.length === 0 ? (
                <p className="pd-medical-empty">
                  {t('Chưa có phiếu bệnh án. Chọn "Thêm" ở mục lục để tạo phiếu mới.')}
                </p>
              ) : (
                shown.map((sheet) => (
                  <MedicalRecordSheetView
                    key={sheet.id}
                    sheet={sheet}
                    auto={auto}
                    zoom={zoom}
                    editable={mode === "single" && sheet.id === active?.id}
                    values={valuesOf(sheet)}
                    mayEditRows={mayEditRows}
                    onChange={(next) => setEdits((current) => ({ ...current, [sheet.id]: next }))}
                  />
                ))
              )}
            </div>
          </div>
          {/* Centred over the sheet, and pinned to the viewport once the
              two columns fold into one. */}
          <div className="pd-medical-barwrap">
            <div className="pd-medical-bar">
              <SegmentedTabs
                items={[
                  { key: "single" as const, label: t("Từng phiếu") },
                  { key: "all" as const, label: t("Toàn bộ") },
                ]}
                activeKey={mode}
                onChange={setMode}
              />

              <div className="pd-medical-zoom">
                <span>{t("Zoom")}</span>
                <Button
                  aria-label={t("Thu nhỏ bệnh án")}
                  title={t("Thu nhỏ")}
                  icon={<Minus size={14} />}
                  disabled={zoom <= ZOOM_MIN}
                  onClick={() =>
                    setZoom((value) => Math.max(ZOOM_MIN, Number((value - ZOOM_STEP).toFixed(1))))
                  }
                />
                <b>{Math.round(zoom * 100)}%</b>
                <Button
                  aria-label={t("Phóng to bệnh án")}
                  title={t("Phóng to")}
                  icon={<Plus size={14} />}
                  disabled={zoom >= ZOOM_MAX}
                  onClick={() =>
                    setZoom((value) => Math.min(ZOOM_MAX, Number((value + ZOOM_STEP).toFixed(1))))
                  }
                />
              </div>

              {mode === "all" ? (
                <PrintSheetPicker sheets={sheets} ordinalOf={ordinalOf} onPrint={printSheets} />
              ) : (
                <Button
                  icon={<Printer size={14} />}
                  disabled={!active}
                  onClick={() => active && printSheets([active.id])}
                >
                  {t("In biểu mẫu")}
                </Button>
              )}

              {/* The reference offers this once sheets are ticked, but wires nothing
              to it yet; ours stays disabled for the same reason. */}
              <Button className="pd-medical-sync" icon={<RefreshCw size={14} />} disabled>
                {t("Đồng bộ phiếu")}
              </Button>

              <Button
                type="primary"
                icon={<Save size={14} />}
                loading={saveSheet.isPending}
                disabled={!active || !formSpecOf(active.form).fillable}
                onClick={() => void handleSave()}
              >
                {saveSheet.isPending ? t("Đang lưu...") : t("Lưu")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AppDialog
        open={Boolean(renaming)}
        title={t("Đổi tên phiếu")}
        width={420}
        canSave={newTitle.trim().length > 0}
        saving={renameSheet.isPending}
        cancelLabel={t("Huỷ")}
        onSave={() => void handleRename()}
        onClose={() => setRenaming(null)}
      >
        <Input
          autoFocus
          value={newTitle}
          aria-label={t("Tên phiếu")}
          onChange={(event) => setNewTitle(event.target.value)}
          onPressEnter={() => void handleRename()}
        />
      </AppDialog>

      <ConfirmDeleteDialog
        open={Boolean(removing)}
        noun={t("phiếu bệnh án")}
        name={removing?.title ?? ""}
        pending={deleteSheet.isPending}
        onConfirm={() => void handleDelete()}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}
