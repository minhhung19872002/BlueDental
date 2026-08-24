import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import {
  PAYMENT_KIND,
  paymentKindConfig,
  paymentMethodLabels,
  usePatientAccount,
  type PatientPaymentDto,
  type PatientPaymentKind,
  type PaymentMethodKind,
} from "../api/treatmentPlanApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { formatDateTime, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";

interface PatientDebtHistoryPanelProps {
  patientId: string;
}

interface DebtRow extends PatientPaymentDto {
  runningCollected: number;
}

/**
 * Lịch sử dư nợ.
 *
 * The reference never exposed a debt ledger of its own, so this reads the same
 * money movements as the invoice tab and shows the running total collected next to
 * them. The arithmetic is a cumulative sum of server values — no balance is invented.
 */
export function PatientDebtHistoryPanel({ patientId }: PatientDebtHistoryPanelProps) {
  const branchId = useCurrentBranchId();
  const { data: account, isLoading } = usePatientAccount(patientId, branchId);

  // The list arrives newest first; the running total has to accumulate oldest first.
  const oldestFirst = [...(account?.payments ?? [])].reverse();
  let running = 0;
  const rowsOldestFirst: DebtRow[] = oldestFirst.map((payment) => {
    running += payment.kind === PAYMENT_KIND.Refund ? -payment.amount : payment.amount;
    return { ...payment, runningCollected: running };
  });
  const rows = rowsOldestFirst.reverse();

  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-3 text-xs text-muted-foreground" data-testid="debt-summary">
          {t("Phải thu hiện tại:")}{" "}
          <strong>{formatVND(account?.payment.debt ?? 0)} {t("đ")}</strong>{" "}
          {t("· Còn lại trên phiếu:")}{" "}
          <strong>{formatVND(account?.payment.totalDue ?? 0)} {t("đ")}</strong>
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
                  <TableHead style={{ width: 160 }}>{t("Ngày giao dịch")}</TableHead>
                  <TableHead style={{ width: 120 }}>{t("Loại")}</TableHead>
                  <TableHead style={{ width: 130 }}>{t("Hình thức")}</TableHead>
                  <TableHead style={{ width: 100 }}>{t("Kế hoạch")}</TableHead>
                  <TableHead style={{ width: 140 }} className="text-right">{t("Số tiền")}</TableHead>
                  <TableHead style={{ width: 150 }} className="text-right">{t("Luỹ kế đã thu")}</TableHead>
                  <TableHead style={{ width: 150 }}>{t("Nhân viên")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("Chưa có lịch sử dư nợ")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const kindConfig = paymentKindConfig()[row.kind as PatientPaymentKind];
                    const isRefund = row.kind === PAYMENT_KIND.Refund;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs">{formatDateTime(row.paidAt)}</TableCell>
                        <TableCell>
                          <span
                            className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                            style={{ background: kindConfig.color + "22", color: kindConfig.color }}
                          >
                            {kindConfig.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{paymentMethodLabels()[row.method as PaymentMethodKind]}</TableCell>
                        <TableCell className="text-xs">{row.treatmentPlanCode ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs" style={{ color: isRefund ? "#ef4d4d" : "#1f8a63" }}>
                          {isRefund ? "-" : "+"}{formatVND(row.amount)} {t("đ")}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {t("{0} đ", formatVND(row.runningCollected))}
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
  );
}
