import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  STAGE_STATUS,
  stageStatusConfig,
  useCompleteStage,
  useContinueStage,
  useLatestTreatmentStage,
  useTreatmentStages,
  type TreatmentStageDto,
} from "../api/stageApi";
import { StageModal } from "./StageModal";
import { formatTeeth } from "../api/consultingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/utils/format";
import { t } from "@/lib/i18n";

interface TreatmentStagePanelProps {
  patientId: string;
}

/**
 * Công đoạn điều trị for one patient.
 *
 * The reference surfaces stages in two places on this tab: the "Dịch vụ có công đoạn
 * gần nhất" card and a "Thêm công đoạn" action per service line. Both read from the
 * same list here, grouped by the service line each stage belongs to.
 */
export function TreatmentStagePanel({ patientId }: TreatmentStagePanelProps) {
  const branchId = useCurrentBranchId();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useTreatmentStages({
    patientId,
    clinicBranchId: branchId,
    maxResultCount: 100,
  });
  const { data: latest } = useLatestTreatmentStage(patientId);

  const continueStage = useContinueStage();
  const completeStage = useCompleteStage();

  const stages = data?.items ?? [];
  const completed = stages.filter((s) => s.status === STAGE_STATUS.Completed).length;
  const progressPercent = stages.length === 0 ? 0 : Math.round((completed / stages.length) * 100);

  const run = async (action: Promise<unknown>, success: string) => {
    try {
      await action;
      toast.success(success);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <>
      <Card style={{ marginTop: 16 }}>
        <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
          <CardTitle className="text-sm font-semibold">{t("Công đoạn điều trị")}</CardTitle>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus size={14} className="mr-1" />
            {t("Công đoạn")}
          </Button>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="mb-3" data-testid="stage-progress">
            <p className="text-xs text-muted-foreground mb-1">
              {t("Tiến độ:")} {completed}/{stages.length} {t("công đoạn")}
            </p>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {t("Công đoạn gần nhất:")}{" "}
              {latest
                ? `${latest.serviceName ?? t("Dịch vụ")} — ${latest.stageNote ?? t("(không có ghi chú)")}`
                : t("Chưa có công đoạn")}
            </p>
          </div>

          {isLoading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 50 }}>#</TableHead>
                    <TableHead style={{ width: 180 }}>{t("Dịch vụ")}</TableHead>
                    <TableHead>{t("Công đoạn")}</TableHead>
                    <TableHead style={{ width: 140 }}>{t("Răng")}</TableHead>
                    <TableHead style={{ width: 140 }}>{t("Bác sĩ")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Ngày dự kiến")}</TableHead>
                    <TableHead style={{ width: 130 }}>{t("Trạng thái")}</TableHead>
                    <TableHead style={{ width: 190 }}>{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {t("Chưa có công đoạn")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stages.map((row: TreatmentStageDto) => {
                      const config = stageStatusConfig()[row.status];
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs">{row.sequenceNumber}</TableCell>
                          <TableCell className="text-xs">{row.serviceName ?? "—"}</TableCell>
                          <TableCell className="text-xs">{row.name}</TableCell>
                          <TableCell className="text-xs">
                            {row.teeth.length === 0 ? "—" : formatTeeth(row.teeth)}
                          </TableCell>
                          <TableCell className="text-xs">{row.staffName ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {row.scheduledDate ? formatDate(row.scheduledDate) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span
                                className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                                style={{ background: config.color + "22", color: config.color }}
                              >
                                {config.label}
                              </span>
                              {row.isImageRequired && row.imageUrls.length === 0 ? (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                                  {t("Cần ảnh")}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.status === STAGE_STATUS.Completed ? (
                              <span className="text-xs text-muted-foreground">{t("Đã xong")}</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                {row.status === STAGE_STATUS.Pending ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-7 px-2"
                                    disabled={continueStage.isPending}
                                    onClick={() =>
                                      run(continueStage.mutateAsync(row.id), t("Đã tiếp tục công đoạn"))
                                    }
                                  >
                                    {t("Tiếp tục")}
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-7 px-2"
                                  disabled={completeStage.isPending}
                                  onClick={() =>
                                    run(completeStage.mutateAsync(row.id), t("Đã hoàn thành công đoạn"))
                                  }
                                >
                                  {t("Hoàn thành")}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <StageModal open={modalOpen} patientId={patientId} onClose={() => setModalOpen(false)} />
    </>
  );
}
