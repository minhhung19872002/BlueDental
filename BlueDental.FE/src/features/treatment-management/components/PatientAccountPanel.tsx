import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
  PAYMENT_KIND,
  paymentKindConfig,
  PAYMENT_METHOD,
  paymentMethodLabels,
  usePatientAccount,
  useRecordPayment,
  type PatientPaymentDto,
  type PatientPaymentKind,
  type PaymentMethodKind,
} from "../api/treatmentPlanApi";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDateTime, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

interface PatientAccountPanelProps {
  patientId: string;
}

interface PaymentFormValues {
  kind: string;
  method: string;
  treatmentPlanId?: string;
  amount: string;
  staffId: string;
}

/**
 * Hóa đơn / công nợ của bệnh nhân.
 *
 * Mirrors the reference's money rollup: what the slips are worth, what has been
 * collected, what is still owed, and what the clinic is holding for the patient.
 * Every figure comes from the server — nothing is added up in the browser.
 */
export function PatientAccountPanel({ patientId }: PatientAccountPanelProps) {
  const branchId = useCurrentBranchId();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: account, isLoading } = usePatientAccount(patientId, branchId);
  const { data: dentists } = useDentistList();
  const recordPayment = useRecordPayment();

  const { control, handleSubmit, watch, reset } = useForm<PaymentFormValues>({
    defaultValues: {
      kind: String(PAYMENT_KIND.Payment),
      method: String(PAYMENT_METHOD.Cash),
      amount: "0",
      treatmentPlanId: undefined,
      staffId: "",
    },
  });

  const kindValue = watch("kind");
  const slips = account?.plans ?? [];

  const tiles = [
    { label: t("Tổng phiếu"), value: account?.payment.totalPrice ?? 0, testId: "acc-total", color: "#101c2c" },
    { label: t("Đã thanh toán"), value: account?.payment.totalPaid ?? 0, testId: "acc-paid", color: "#1f8a63" },
    { label: t("Hoàn tiền"), value: account?.payment.totalRefund ?? 0, testId: "acc-refund", color: "#dd9426" },
    { label: t("Còn lại"), value: account?.payment.totalDue ?? 0, testId: "acc-due", color: "#ef4d4d" },
    { label: t("Phải thu"), value: account?.payment.debt ?? 0, testId: "acc-debt", color: "#ef4d4d" },
    { label: t("Đang giữ hộ"), value: account?.heldForPatient ?? 0, testId: "acc-held", color: "#1c3566" },
  ];

  const onSubmit = async (values: PaymentFormValues) => {
    try {
      await recordPayment.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        treatmentPlanId: Number(values.kind) === PAYMENT_KIND.Prepaid ? undefined : values.treatmentPlanId,
        kind: Number(values.kind) as PatientPaymentKind,
        method: Number(values.method) as PaymentMethodKind,
        amount: Number(values.amount),
        staffId: values.staffId,
      });

      toast.success(t("Đã ghi nhận giao dịch"));
      setModalOpen(false);
      reset();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const kindConfig = paymentKindConfig();
  const methodLabels = paymentMethodLabels();

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} className="mr-2" />
          {t("Ghi nhận thanh toán")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {tiles.map((tile) => (
          <Card key={tile.testId} data-testid={tile.testId}>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{tile.label}</div>
              <div className="text-lg font-bold" style={{ color: tile.color }}>
                {formatVND(tile.value)} {t("đ")}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">{t("Lịch sử giao dịch")}</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {isLoading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 150 }}>{t("Ngày")}</TableHead>
                    <TableHead style={{ width: 120 }}>{t("Số phiếu")}</TableHead>
                    <TableHead style={{ width: 110 }}>{t("Loại")}</TableHead>
                    <TableHead style={{ width: 130 }}>{t("Hình thức")}</TableHead>
                    <TableHead style={{ width: 100 }}>{t("Kế hoạch")}</TableHead>
                    <TableHead style={{ width: 140 }} className="text-right">{t("Số tiền")}</TableHead>
                    <TableHead style={{ width: 150 }}>{t("Người thu")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(account?.payments ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8" style={{ color: "#98a4b4" }}>
                        {t("Chưa có giao dịch")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (account?.payments ?? []).map((row: PatientPaymentDto) => {
                      const kConfig = kindConfig[row.kind as PatientPaymentKind];
                      const isRefund = row.kind === PAYMENT_KIND.Refund;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs">{formatDateTime(row.paidAt)}</TableCell>
                          <TableCell className="text-xs">{row.code}</TableCell>
                          <TableCell>
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                              style={{ background: kConfig.color + "22", color: kConfig.color }}
                            >
                              {kConfig.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">{methodLabels[row.method as PaymentMethodKind]}</TableCell>
                          <TableCell className="text-xs">{row.treatmentPlanCode ?? "—"}</TableCell>
                          <TableCell className="text-xs text-right" style={{ color: isRefund ? "#ef4d4d" : "#1f8a63" }}>
                            {isRefund ? "-" : ""}
                            {formatVND(row.amount)} {t("đ")}
                          </TableCell>
                          <TableCell className="text-xs">{row.staffName ?? "—"}</TableCell>
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

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); reset(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Ghi nhận thanh toán")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Loại giao dịch")}</label>
              <Controller
                name="kind"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(kindConfig).map(([value, config]) => (
                        <SelectItem key={value} value={String(value)}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {Number(kindValue) !== PAYMENT_KIND.Prepaid && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">{t("Kế hoạch điều trị")}</label>
                <Controller
                  name="treatmentPlanId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            slips.length === 0
                              ? t("Bệnh nhân chưa có kế hoạch điều trị")
                              : t("Chọn kế hoạch")
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {slips.map((slip) => (
                          <SelectItem key={slip.id} value={slip.id}>
                            {t("{0} — còn lại {1} đ", slip.code, formatVND(slip.payment.totalDue))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Hình thức")}</label>
              <Controller
                name="method"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(methodLabels).map(([value, label]) => (
                        <SelectItem key={value} value={String(value)}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Số tiền (đ)")}</label>
              <Controller
                name="amount"
                control={control}
                render={({ field }) => (
                  <Input {...field} type="number" min={0} step={100000} placeholder="0" />
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Người thu")}</label>
              <Controller
                name="staffId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("Chọn nhân viên")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(dentists ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setModalOpen(false); reset(); }}>
                {t("Huỷ")}
              </Button>
              <Button type="submit" disabled={recordPayment.isPending}>
                {recordPayment.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("Lưu")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
