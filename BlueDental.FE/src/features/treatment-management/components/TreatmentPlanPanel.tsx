import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  planStatusConfig,
  SERVICE_LINE_STATUS,
  serviceLineStatusConfig,
  useCancelServiceLine,
  useCompleteServiceLine,
  useOpenTreatmentPlan,
  useTreatmentPlans,
  type TreatmentPlanSlipDto,
  type TreatmentServiceDto,
} from "../api/treatmentPlanApi";
import { usePatientAdvises } from "../api/consultingQueries";
import { ADVISE_STATUS } from "../api/consultingApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { downloadFile } from "@/lib/download";
import { formatDate, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

interface TreatmentPlanPanelProps {
  patientId: string;
}

/** One row of the reference's treatment-plan table: a slip flattened per service line. */
interface PlanRow extends TreatmentServiceDto {
  planId: string;
  planCode: string;
  planStatus: TreatmentPlanSlipDto["status"];
  planProgress: number;
  dentistName: string | null;
  planCreatedAt: string;
  planPayment: TreatmentPlanSlipDto["payment"];
}

/**
 * Kế hoạch điều trị.
 *
 * The reference renders one row per service line, carrying the slip's number, the
 * receiving dentist and the slip money. Everything money-side is derived by the
 * server, so this component only formats.
 */
export function TreatmentPlanPanel({ patientId }: TreatmentPlanPanelProps) {
  const branchId = useCurrentBranchId();
  const [opening, setOpening] = useState(false);

  const { data: plans, isLoading } = useTreatmentPlans(patientId, branchId);
  const { data: advises } = usePatientAdvises({ patientId });
  const { data: dentists } = useDentistList();

  const openPlan = useOpenTreatmentPlan();
  const completeLine = useCompleteServiceLine();
  const cancelLine = useCancelServiceLine();

  const acceptedCount = (advises?.items ?? []).filter(
    (advise) => advise.status === ADVISE_STATUS.Accepted,
  ).length;

  const slips = plans?.items ?? [];
  const rows: PlanRow[] = slips.flatMap((slip) =>
    slip.services.map((line) => ({
      ...line,
      planId: slip.id,
      planCode: slip.code,
      planStatus: slip.status,
      planProgress: slip.progressPercent,
      dentistName: slip.dentistName,
      planCreatedAt: slip.creationTime,
      planPayment: slip.payment,
    })),
  );

  const activeServices = rows.filter((r) => r.status === SERVICE_LINE_STATUS.InProgress);

  const run = async (action: Promise<unknown>, success: string) => {
    try {
      await action;
      toast.success(success);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const handleOpenPlan = async () => {
    const dentistId = dentists?.[0]?.id;
    if (!dentistId) {
      toast.error(t("Chưa có bác sĩ để tiếp nhận kế hoạch"));
      return;
    }

    setOpening(true);
    try {
      await openPlan.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        dentistId,
      });
      toast.success(t("Đã tạo kế hoạch điều trị"));
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end gap-2 mb-4">
        <Button
          disabled={acceptedCount === 0 || opening}
          onClick={handleOpenPlan}
        >
          {opening ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
          {t("Tạo kế hoạch mới")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div
          className="p-3 rounded-lg border"
          style={{ borderLeft: "4px solid #1c3566" }}
          data-testid="plan-active-services"
        >
          <div className="flex items-center gap-2">
            <span
              className="text-white rounded-full px-3 py-0.5 font-bold text-sm"
              style={{ background: "#1c3566" }}
            >
              {activeServices.length}
            </span>
            <div>
              <div className="font-semibold text-sm" style={{ color: "#101c2c" }}>
                {t("Dịch vụ đang điều trị")}
              </div>
              <div className="text-xs" style={{ color: "#98a4b4" }}>
                {activeServices.length === 0
                  ? t("Chưa có dịch vụ đang điều trị")
                  : activeServices.map((s) => s.serviceName ?? s.code).join(", ")}
              </div>
            </div>
          </div>
        </div>

        <div
          className="p-3 rounded-lg border"
          style={{ borderLeft: "4px solid #1f8a63" }}
          data-testid="plan-slip-count"
        >
          <div className="font-semibold text-sm mb-1" style={{ color: "#101c2c" }}>
            {t("Phiếu điều trị")}
          </div>
          <div className="text-xs" style={{ color: "#98a4b4" }}>
            {slips.length === 0
              ? acceptedCount === 0
                ? t("Chưa có phiếu — hãy chốt phiếu tư vấn trước")
                : t("{0} dịch vụ đã chốt, sẵn sàng lên kế hoạch", acceptedCount)
              : slips
                  .map(
                    (s) =>
                      `${s.code} · ${planStatusConfig()[s.status].label} · ${s.progressPercent}%`,
                  )
                  .join(" — ")}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          {isLoading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 90 }}>{t("Số phiếu")}</TableHead>
                    <TableHead style={{ width: 200 }}>{t("Dịch vụ")}</TableHead>
                    <TableHead style={{ width: 150 }}>{t("Bác sĩ tiếp nhận")}</TableHead>
                    <TableHead style={{ width: 190 }}>{t("Trạng thái - Tiến độ")}</TableHead>
                    <TableHead style={{ width: 110 }}>{t("Ngày tạo")}</TableHead>
                    <TableHead style={{ width: 120 }} className="text-right">{t("Tổng phiếu")}</TableHead>
                    <TableHead style={{ width: 110 }} className="text-right">{t("Giảm giá")}</TableHead>
                    <TableHead style={{ width: 120 }} className="text-right">{t("Thành tiền")}</TableHead>
                    <TableHead style={{ width: 120 }} className="text-right">{t("Đã trả")}</TableHead>
                    <TableHead style={{ width: 110 }} className="text-right">{t("Hoàn tiền")}</TableHead>
                    <TableHead style={{ width: 120 }} className="text-right">{t("Còn lại")}</TableHead>
                    <TableHead style={{ width: 110 }} className="text-right">{t("Phải thu")}</TableHead>
                    <TableHead style={{ width: 250 }}>{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8" style={{ color: "#98a4b4" }}>
                        {t("Chưa có kế hoạch điều trị")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const lineConfig = serviceLineStatusConfig()[row.status];
                      const isFinished =
                        row.status === SERVICE_LINE_STATUS.Done ||
                        row.status === SERVICE_LINE_STATUS.Cancelled;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs">{row.planCode}</TableCell>
                          <TableCell className="text-xs">{row.serviceName ?? row.code}</TableCell>
                          <TableCell className="text-xs">{row.dentistName ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span
                                className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                                style={{ background: lineConfig.color + "22", color: lineConfig.color }}
                              >
                                {lineConfig.label}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {row.completedStageCount}/{row.stageCount} {t("công đoạn")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(row.planCreatedAt)}</TableCell>
                          <TableCell className="text-xs text-right">{t("{0} đ", formatVND(row.grossAmount))}</TableCell>
                          <TableCell className="text-xs text-right">{t("{0} đ", formatVND(row.discountAmount))}</TableCell>
                          <TableCell className="text-xs text-right">{t("{0} đ", formatVND(row.effectiveAmount))}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: "#1f8a63" }}>
                            {formatVND(row.planPayment.totalPaid)} {t("đ")}
                          </TableCell>
                          <TableCell className="text-xs text-right">{t("{0} đ", formatVND(row.planPayment.totalRefund))}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: "#ef4d4d" }}>
                            {formatVND(row.planPayment.totalDue)} {t("đ")}
                          </TableCell>
                          <TableCell className="text-xs text-right">{t("{0} đ", formatVND(row.planPayment.debt))}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() =>
                                  void downloadFile(
                                    `/v1/app/patient-treatments/${row.planId}/pdf`,
                                    `phieu-dieu-tri-${row.planCode}.pdf`,
                                  )
                                }
                              >
                                {t("In phiếu")}
                              </Button>
                              {!isFinished && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-2"
                                    disabled={completeLine.isPending}
                                    onClick={() =>
                                      run(
                                        completeLine.mutateAsync({ planId: row.planId, lineId: row.id }),
                                        t("Đã hoàn thành dịch vụ"),
                                      )
                                    }
                                  >
                                    {t("Hoàn thành")}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                                    disabled={cancelLine.isPending}
                                    onClick={() =>
                                      run(
                                        cancelLine.mutateAsync({ planId: row.planId, lineId: row.id }),
                                        t("Đã huỷ dịch vụ"),
                                      )
                                    }
                                  >
                                    {t("Huỷ")}
                                  </Button>
                                </>
                              )}
                            </div>
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
    </div>
  );
}
