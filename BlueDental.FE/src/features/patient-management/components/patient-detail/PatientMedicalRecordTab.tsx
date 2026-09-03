import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "antd";
import { DeleteOutlined, MinusOutlined, PlusOutlined, PrinterOutlined, SaveOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { AppDialog } from "@/components/AppDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import {
  useAddMedicalRecord,
  useDeleteMedicalRecord,
  usePatientMedicalRecords,
  useRenameMedicalRecord,
  useSaveMedicalRecord,
  type PatientMedicalRecordDto,
} from "../../api/medicalRecordApi";
import { MedicalRecordIndex } from "./MedicalRecordIndex";
import { MedicalRecordSheetView } from "./MedicalRecordSheetView";
import { formSpecOf, type MedicalRecordFormSpec } from "./medicalRecordForms";
import { parseFields, parseBody, type SheetDraft } from "./medicalRecordDraft";
import type { PatientDto } from "../../types/patient";

/**
 * Bệnh án — the second view behind the header's Chi tiết hồ sơ / Bệnh án switch.
 *
 * "Mục lục bệnh án" on the left adds a sheet and lists the ones already made,
 * nested under the form each came from; the canvas on the right shows the one
 * being worked on, and the bar along the bottom carries the view mode, the
 * zoom, printing and the save.
 */

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;

type ViewMode = "single" | "all";

interface TabProps {
  patientId: string;
  /** Printed onto the sheets that carry the patient's identity. */
  patient?: PatientDto;
}

export function PatientMedicalRecordTab({ patientId, patient }: TabProps) {
  const query = usePatientMedicalRecords(patientId);
  const addSheet = useAddMedicalRecord(patientId);
  const saveSheet = useSaveMedicalRecord(patientId);
  const renameSheet = useRenameMedicalRecord(patientId);
  const deleteSheet = useDeleteMedicalRecord(patientId);

  const sheets = useMemo(() => query.data?.items ?? [], [query.data]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("single");
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(false);
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState<SheetDraft>({ fields: {}, body: "" });
  const [removing, setRemoving] = useState<PatientMedicalRecordDto | null>(null);
  const [renaming, setRenaming] = useState<PatientMedicalRecordDto | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const active = sheets.find((sheet) => sheet.id === activeId) ?? sheets[0] ?? null;

  // The draft follows whichever sheet is open, and is re-seeded when the server
  // hands back a newer copy of it.
  useEffect(() => {
    setDraft({
      fields: parseFields(active?.content ?? null),
      body: parseBody(active?.content ?? null),
    });
  }, [active?.id, active?.lastModificationTime, active?.content]);

  /** `Bản NN` for a sheet: its position among the sheets of its own form. */
  const ordinalOf = (sheet: PatientMedicalRecordDto) =>
    sheets.filter((item) => item.form === sheet.form).findIndex((item) => item.id === sheet.id) + 1;

  const handleAdd = async (spec: MedicalRecordFormSpec) => {
    try {
      const created = await addSheet.mutateAsync({ form: spec.form, title: t(spec.label) });
      setActiveId(created.id);
      toast.success(t("Đã thêm phiếu bệnh án"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleSave = async () => {
    if (!active) return;
    try {
      await saveSheet.mutateAsync({ id: active.id, content: JSON.stringify(draft) });
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

  const handleCheck = (sheet: PatientMedicalRecordDto, checked: boolean) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(sheet.id);
      else next.delete(sheet.id);
      return next;
    });
  };

  // "Toàn bộ" shows every sheet; ticking cards narrows both it and the print to
  // the chosen ones.
  const chosen = checkedIds.size > 0 ? sheets.filter((s) => checkedIds.has(s.id)) : sheets;
  const shown = mode === "all" ? chosen : active ? [active] : [];

  return (
    <section className="pd-pane pd-pane--fill pd-medical">
      <div className="pd-medical-grid">
        <MedicalRecordIndex
          sheets={sheets}
          activeId={active?.id ?? null}
          checkedIds={checkedIds}
          collapsed={collapsed}
          adding={addSheet.isPending}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          onAdd={(spec) => void handleAdd(spec)}
          onSelect={(sheet) => setActiveId(sheet.id)}
          onCheck={handleCheck}
          onPrint={(sheet) => {
            setActiveId(sheet.id);
            setMode("single");
            window.print();
          }}
          onRename={(sheet) => {
            setRenaming(sheet);
            setNewTitle(sheet.title);
          }}
          onDelete={(sheet) => setRemoving(sheet)}
        />

        <div className="pd-medical-canvas">
          {active && (
            <header className="pd-medical-canvas-head">
              <small>
                {t("Bản")} {String(ordinalOf(active)).padStart(2, "0")}
              </small>
              <strong>{active.title}</strong>
            </header>
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
                  patient={patient}
                  zoom={zoom}
                  editable={sheet.id === active?.id}
                  draft={sheet.id === active?.id ? draft : null}
                  onChange={setDraft}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <footer className="pd-medical-bar">
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
            aria-label={t("Thu nhỏ")}
            icon={<MinusOutlined />}
            disabled={zoom <= ZOOM_MIN}
            onClick={() => setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))}
          />
          <b>{Math.round(zoom * 100)}%</b>
          <Button
            aria-label={t("Phóng to")}
            icon={<PlusOutlined />}
            disabled={zoom >= ZOOM_MAX}
            onClick={() => setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))}
          />
        </div>

        <Button
          icon={<PrinterOutlined />}
          disabled={shown.length === 0}
          onClick={() => window.print()}
        >
          {t("In biểu mẫu")}
        </Button>

        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={!active}
          onClick={() => setRemoving(active)}
        >
          {t("Xoá phiếu")}
        </Button>

        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={saveSheet.isPending}
          disabled={!active || !formSpecOf(active.form).fillable}
          onClick={() => void handleSave()}
        >
          {t("Lưu")}
        </Button>
      </footer>

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
