import { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { DatePickerInput } from "@/components/ui/date-picker-input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, MinusCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  PRESCRIPTION_STATUS,
  prescriptionStatusConfig,
  useCancelPrescription,
  useCreatePrescription,
  useDispensePrescription,
  usePrescriptions,
  type PrescriptionDto,
} from "../api/prescriptionApi";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { useDentistList } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { downloadFile } from "@/lib/download";
import { formatDate } from "@/utils/format";
import { t } from "@/lib/i18n";

interface PrescriptionPanelProps {
  patientId: string;
}

interface PrescriptionItemFormValues {
  medicationId: string;
  dosage: string;
  frequency: string;
  durationDays: string;
  quantity: string;
}

interface PrescriptionFormValues {
  staffId: string;
  diagnosisText?: string;
  followUpDate?: string;
  note?: string;
  items: PrescriptionItemFormValues[];
}

/**
 * Đơn thuốc.
 *
 * The reference lists slips with "Mã đơn thuốc, Bác sĩ, Chẩn đoán, Tái khám,
 * Ngày tạo"; the medicines are the slip's lines and come from the Loại thuốc
 * catalog.
 */
export function PrescriptionPanel({ patientId }: PrescriptionPanelProps) {
  const branchId = useCurrentBranchId();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = usePrescriptions(patientId, branchId);
  const { data: medications } = useCatalogOptions(CATALOG_GROUP.MedicationType);
  const { data: dentists } = useDentistList();

  const createPrescription = useCreatePrescription();
  const dispensePrescription = useDispensePrescription();
  const cancelPrescription = useCancelPrescription();

  const { control, handleSubmit, reset } = useForm<PrescriptionFormValues>({
    defaultValues: {
      items: [{ medicationId: "", dosage: "", frequency: "", durationDays: "5", quantity: "10" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const run = async (action: Promise<unknown>, success: string) => {
    try {
      await action;
      toast.success(success);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const onSubmit = async (values: PrescriptionFormValues) => {
    try {
      await createPrescription.mutateAsync({
        patientId,
        clinicBranchId: branchId,
        staffId: values.staffId,
        diagnosisText: values.diagnosisText,
        followUpDate: values.followUpDate,
        note: values.note,
        items: values.items.map((item) => ({
          medicationId: item.medicationId,
          dosage: item.dosage,
          frequency: item.frequency,
          durationDays: Number(item.durationDays),
          quantity: Number(item.quantity),
        })),
      });

      toast.success(t("Đã tạo đơn thuốc"));
      setModalOpen(false);
      reset();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const statusConfig = prescriptionStatusConfig();

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} className="mr-2" />
          {t("Tạo đơn thuốc")}
        </Button>
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
                    <TableHead style={{ width: 130 }}>{t("Mã đơn thuốc")}</TableHead>
                    <TableHead style={{ width: 150 }}>{t("Bác sĩ")}</TableHead>
                    <TableHead>{t("Chẩn đoán")}</TableHead>
                    <TableHead style={{ width: 240 }}>{t("Thuốc")}</TableHead>
                    <TableHead style={{ width: 110 }}>{t("Tái khám")}</TableHead>
                    <TableHead style={{ width: 110 }}>{t("Ngày tạo")}</TableHead>
                    <TableHead style={{ width: 110 }}>{t("Trạng thái")}</TableHead>
                    <TableHead style={{ width: 230 }}>{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.items ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8" style={{ color: "#98a4b4" }}>
                        {t("Chưa có đơn thuốc")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    (data?.items ?? []).map((row: PrescriptionDto) => {
                      const sConfig = statusConfig[row.status];
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="text-xs">{row.code}</TableCell>
                          <TableCell className="text-xs">{row.staffName ?? "—"}</TableCell>
                          <TableCell className="text-xs">{row.diagnosisText ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            {row.items.length === 0
                              ? "—"
                              : row.items.map((item) => t("{0} ×{1}", item.medicationName, item.quantity)).join(", ")}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.followUpDate ? formatDate(row.followUpDate) : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{formatDate(row.issuedAt)}</TableCell>
                          <TableCell>
                            <span
                              className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                              style={{ background: sConfig.color + "22", color: sConfig.color }}
                            >
                              {sConfig.label}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7 px-2"
                                onClick={() =>
                                  void downloadFile(
                                    `/v1/app/prescriptions/${row.id}/pdf`,
                                    `don-thuoc-${row.code}.pdf`,
                                  )
                                }
                              >
                                {t("In đơn")}
                              </Button>
                              {row.status === PRESCRIPTION_STATUS.Active ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-2"
                                    disabled={dispensePrescription.isPending}
                                    onClick={() =>
                                      run(dispensePrescription.mutateAsync(row.id), t("Đã phát thuốc"))
                                    }
                                  >
                                    {t("Phát thuốc")}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                                    disabled={cancelPrescription.isPending}
                                    onClick={() =>
                                      run(cancelPrescription.mutateAsync(row.id), t("Đã huỷ đơn thuốc"))
                                    }
                                  >
                                    {t("Huỷ")}
                                  </Button>
                                </>
                              ) : null}
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

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); reset(); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("Tạo đơn thuốc")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Bác sĩ kê đơn")} <span className="text-destructive">*</span></label>
              <Controller
                name="staffId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("Chọn bác sĩ")} />
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

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Chẩn đoán")}</label>
              <Controller
                name="diagnosisText"
                control={control}
                render={({ field }) => (
                  <Input {...field} placeholder={t("Chẩn đoán trên đơn")} maxLength={500} />
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Tái khám")}</label>
              <Controller
                name="followUpDate"
                control={control}
                render={({ field }) => (
                  <DatePickerInput value={field.value} onChange={(v) => field.onChange(v)} />
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">{t("Thuốc")}</label>
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2" data-testid="prescription-medicine">
                  <div style={{ width: 220 }}>
                    <Controller
                      name={`items.${index}.medicationId`}
                      control={control}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                (medications?.length ?? 0) === 0
                                  ? t("Chưa có danh mục thuốc")
                                  : t("Chọn thuốc")
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(medications ?? []).map((m) => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <Controller
                    name={`items.${index}.dosage`}
                    control={control}
                    render={({ field: f }) => (
                      <Input {...f} placeholder={t("Liều dùng")} style={{ width: 110 }} />
                    )}
                  />
                  <Controller
                    name={`items.${index}.frequency`}
                    control={control}
                    render={({ field: f }) => (
                      <Input {...f} placeholder={t("Tần suất")} style={{ width: 120 }} />
                    )}
                  />
                  <Controller
                    name={`items.${index}.durationDays`}
                    control={control}
                    render={({ field: f }) => (
                      <Input {...f} type="number" min={1} placeholder={t("Ngày")} style={{ width: 90 }} />
                    )}
                  />
                  <Controller
                    name={`items.${index}.quantity`}
                    control={control}
                    render={({ field: f }) => (
                      <Input {...f} type="number" min={1} placeholder="SL" style={{ width: 90 }} />
                    )}
                  />
                  {fields.length > 1 && (
                    <MinusCircle
                      size={16}
                      className="cursor-pointer text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => remove(index)}
                    />
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ medicationId: "", dosage: "", frequency: "", durationDays: "5", quantity: "10" })}
              >
                <Plus size={14} className="mr-2" />
                {t("Thêm thuốc")}
              </Button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">{t("Ghi chú")}</label>
              <Controller
                name="note"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    rows={2}
                    maxLength={1000}
                    placeholder={t("Lời dặn của bác sĩ")}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setModalOpen(false); reset(); }}>
                {t("Huỷ")}
              </Button>
              <Button type="submit" disabled={createPrescription.isPending}>
                {createPrescription.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("Tạo")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
