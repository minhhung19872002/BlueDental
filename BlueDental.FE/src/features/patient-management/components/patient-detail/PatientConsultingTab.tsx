import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Select, Typography } from "antd";
import { toast } from "sonner";
import {
  useCancelDiagnosis,
  usePatientAdviseSummary,
  usePatientAdvises,
  usePatientDiagnoses,
  useRejectAdvise,
} from "@/features/treatment-management/api/consultingQueries";
import type {
  PatientAdviseDto,
  PatientDiagnosisDto,
} from "@/features/treatment-management/api/consultingApi";
import { DiagnosisModal } from "@/features/treatment-management/components/DiagnosisModal";
import { AdviseModal } from "@/features/treatment-management/components/AdviseModal";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { TAXONOMY_GROUP, useCatalogEntries } from "@/features/taxonomy/api/taxonomyApi";
import { AppointmentEditorModal } from "@/features/appointments/components/AppointmentEditorModal";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useTablePagination } from "@/hooks/useTablePagination";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { usePatientImages, useUploadPatientImage } from "../../api/patientImageApi";
import { DentalChartView, type ToothRecord } from "../DentalChartView";
import { PatientAdviseCard } from "./PatientAdviseCard";
import { PatientConsultingImagePanel } from "./PatientConsultingImagePanel";
import { PatientDiagnosisCard } from "./PatientDiagnosisCard";

const { Text } = Typography;

/** FDI numbers, jaw by jaw, matching DentalChartView's own rows. */
const UPPER_JAW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_JAW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/**
 * The four shortcuts over the chart. "Chọn Răng" clears back to picking teeth
 * one at a time; the other three fill in a whole jaw at once, which is what a
 * diagnosis like "Nguyên hàm" needs.
 */
const JAW_PRESETS = [
  { key: "teeth", label: "Chọn Răng", fdis: [] as number[] },
  { key: "upper", label: "Hàm Trên", fdis: UPPER_JAW },
  { key: "lower", label: "Hàm Dưới", fdis: LOWER_JAW },
  { key: "full", label: "Nguyên Hàm", fdis: [...UPPER_JAW, ...LOWER_JAW] },
] as const;

type JawPreset = (typeof JAW_PRESETS)[number]["key"];

/**
 * Chẩn đoán & Tư vấn.
 *
 * Laid out as the reference lays it out: the image panel and the diagnosis card
 * share the top row, the consulting sheet fills the width underneath. Both
 * cards are the app's own table card, so the header stays put, the rows scroll
 * and the pager is pinned to the bottom.
 */
export function PatientConsultingTab({ patientId }: { patientId: string }) {
  const branchId = useCurrentBranchId();
  const navigate = useNavigate();

  const [expanded, setExpanded] = useState(false);
  const [selectedTeeth, setSelectedTeeth] = useState<ToothRecord[]>([]);
  const [preset, setPreset] = useState<JawPreset>("teeth");
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [adviseDiagnosis, setAdviseDiagnosis] = useState<PatientDiagnosisDto | null>(null);
  const [scheduling, setScheduling] = useState<PatientDiagnosisDto | null>(null);
  const [removingDiagnosis, setRemovingDiagnosis] = useState<PatientDiagnosisDto | null>(null);
  const [removingAdvise, setRemovingAdvise] = useState<PatientAdviseDto | null>(null);
  const [selectedAdvises, setSelectedAdvises] = useState<string[]>([]);

  const diagnosisPaging = useTablePagination(20);
  const advisePaging = useTablePagination(20);
  const scope = { patientId, clinicBranchId: branchId ?? undefined };

  const diagnoses = usePatientDiagnoses({
    ...scope,
    skipCount: diagnosisPaging.skipCount,
    maxResultCount: diagnosisPaging.maxResultCount,
  });
  const advises = usePatientAdvises({
    ...scope,
    skipCount: advisePaging.skipCount,
    maxResultCount: advisePaging.maxResultCount,
  });
  const summary = usePatientAdviseSummary(scope).data;
  const dentists = useDentistList().data ?? [];
  // "Dữ liệu tư vấn" is a catalog group like any other, read through the same
  // endpoint the Danh mục screen uses.
  const consultingData =
    useCatalogEntries(branchId ?? undefined, TAXONOMY_GROUP.ConsultingData, {
      scope: "catalog",
      skipCount: 0,
      maxResultCount: 200,
    }).data?.items ?? [];
  const images = usePatientImages(patientId, branchId ?? "").data?.items ?? [];
  const uploadImage = useUploadPatientImage();
  const cancelDiagnosis = useCancelDiagnosis();
  const rejectAdvise = useRejectAdvise();

  const chooseTooth = (fdi: number) => {
    setPreset("teeth");
    setSelectedTeeth((current) =>
      current.some((item) => item.fdi === fdi)
        ? current.filter((item) => item.fdi !== fdi)
        : [...current, { fdi, status: "treated" }],
    );
  };

  const choosePreset = (next: JawPreset) => {
    setPreset(next);
    setSelectedTeeth(
      (JAW_PRESETS.find((item) => item.key === next)?.fdis ?? []).map((fdi) => ({
        fdi,
        status: "treated" as const,
      })),
    );
  };

  const handleUpload = async (files: File[]) => {
    if (!branchId) return;
    try {
      for (const file of files) {
        await uploadImage.mutateAsync({ patientId, clinicBranchId: branchId, file });
      }
      toast.success(t("Đã tải ảnh lên"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleCancelDiagnosis = async () => {
    if (!removingDiagnosis) return;
    try {
      await cancelDiagnosis.mutateAsync(removingDiagnosis.id);
      toast.success(t("Đã xoá chẩn đoán"));
      setRemovingDiagnosis(null);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  /**
   * An advise is never hard-deleted — the server turns it down instead, which
   * is what keeps it out of the plan while the history stays readable.
   */
  const handleRejectAdvise = async () => {
    if (!removingAdvise) return;
    try {
      await rejectAdvise.mutateAsync(removingAdvise.id);
      toast.success(t("Đã từ chối dịch vụ tư vấn"));
      setRemovingAdvise(null);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <section className="pd-pane pd-consulting">
      <div className="pd-consulting-grid">
        <PatientConsultingImagePanel
          images={images.map((image) => ({
            id: image.id,
            name: image.fileName,
            url: image.url,
          }))}
          catalog={consultingData}
          onUpload={(files) => void handleUpload(files)}
        />

        <PatientDiagnosisCard
          rows={diagnoses.data?.items ?? []}
          totalCount={diagnoses.data?.totalCount ?? 0}
          loading={diagnoses.isFetching}
          pagination={diagnosisPaging}
          expanded={expanded}
          onToggleForm={() => setExpanded((value) => !value)}
          onCreateService={setAdviseDiagnosis}
          onSchedule={setScheduling}
          onDelete={setRemovingDiagnosis}
        >
          {expanded && (
            <div className="pd-diagnosis-form" data-testid="diagnosis-form">
              <div className="pd-form-row">
                <Select
                  placeholder={t("Bác sĩ chẩn đoán 1 *")}
                  options={dentists.map((item) => ({ value: item.id, label: item.name }))}
                />
                <Select
                  placeholder={t("Bác sĩ chẩn đoán 2")}
                  options={dentists.map((item) => ({ value: item.id, label: item.name }))}
                />
              </div>
              <div className="pd-tooth-tabs" role="group" aria-label={t("Chọn vùng răng")}>
                {JAW_PRESETS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={preset === item.key}
                    className={preset === item.key ? "active" : undefined}
                    onClick={() => choosePreset(item.key)}
                  >
                    {t(item.label)}
                  </button>
                ))}
              </div>
              <DentalChartView teeth={selectedTeeth} onToothClick={chooseTooth} />
              <div className="pd-form-row">
                <Select placeholder={t("Chọn chẩn đoán")} />
                <Input placeholder={t("Ghi chú")} />
              </div>
              <Text type="secondary">
                {t("Răng đã chọn")}: {selectedTeeth.map((item) => item.fdi).join(", ") || "—"}
              </Text>
              <div className="pd-form-footer">
                <Button
                  type="primary"
                  disabled={selectedTeeth.length === 0}
                  onClick={() => setDiagnosisOpen(true)}
                >
                  {t("Lưu chẩn đoán")}
                </Button>
              </div>
            </div>
          )}
        </PatientDiagnosisCard>
      </div>

      <PatientAdviseCard
        rows={advises.data?.items ?? []}
        totalCount={advises.data?.totalCount ?? 0}
        loading={advises.isFetching}
        pagination={advisePaging}
        summary={summary}
        dentists={dentists}
        selected={selectedAdvises}
        onSelect={setSelectedAdvises}
        onOpenAdvise={() => setAdviseDiagnosis(diagnoses.data?.items[0] ?? null)}
        onDelete={setRemovingAdvise}
        onAddToPlan={() => navigate(`?tab=treatment-plan${branchId ? `&branchId=${branchId}` : ""}`)}
        onQuote={() => window.print()}
        onPrint={() => window.print()}
      />

      <DiagnosisModal
        open={diagnosisOpen}
        patientId={patientId}
        teeth={selectedTeeth.map((item) => ({
          toothCode: item.fdi,
          selected: true,
          top: false,
          right: false,
          bottom: false,
          left: false,
          center: true,
        }))}
        onClose={() => setDiagnosisOpen(false)}
        onCreated={() => void diagnoses.refetch()}
      />

      <AdviseModal
        open={Boolean(adviseDiagnosis)}
        patientId={patientId}
        diagnosis={adviseDiagnosis}
        onClose={() => setAdviseDiagnosis(null)}
        onCreated={() => void advises.refetch()}
      />

      <AppointmentEditorModal
        open={Boolean(scheduling)}
        initialPatientId={patientId}
        initialReason={scheduling?.diagnosisName ?? undefined}
        lockPatient
        onClose={() => setScheduling(null)}
      />

      <ConfirmDeleteDialog
        open={Boolean(removingDiagnosis)}
        noun={t("chẩn đoán")}
        name={removingDiagnosis?.code ?? ""}
        pending={cancelDiagnosis.isPending}
        onConfirm={() => void handleCancelDiagnosis()}
        onClose={() => setRemovingDiagnosis(null)}
      />

      <ConfirmDeleteDialog
        open={Boolean(removingAdvise)}
        noun={t("dịch vụ tư vấn")}
        name={removingAdvise?.serviceName ?? ""}
        pending={rejectAdvise.isPending}
        onConfirm={() => void handleRejectAdvise()}
        onClose={() => setRemovingAdvise(null)}
      />
    </section>
  );
}
