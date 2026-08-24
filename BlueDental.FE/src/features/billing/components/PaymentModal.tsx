import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  PAYMENT_METHOD,
  paymentMethodLabels,
  useRecordPayment,
  type InvoiceDto,
  type PaymentMethod,
} from "../api";
import { extractApiError } from "@/lib/apiError";
import { formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  invoice: InvoiceDto | null;
  onClose: () => void;
}

export function PaymentModal({ open, invoice, onClose }: Props) {
  const recordPayment = useRecordPayment();
  const outstanding = invoice?.balanceDue ?? 0;
  const methodLabels = paymentMethodLabels();

  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>(String(PAYMENT_METHOD.Cash));
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && invoice) {
      setAmount(String(outstanding));
      setMethod(String(PAYMENT_METHOD.Cash));
      setReference("");
      setErrors({});
    }
  }, [open, invoice, outstanding]);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const numAmount = Number(amount);
    if (!amount || isNaN(numAmount) || numAmount < 1) {
      errs.amount = t("Số tiền phải lớn hơn 0");
    } else if (numAmount > outstanding) {
      errs.amount = t("Không thu quá số còn lại");
    }
    if (!method) errs.method = t("Vui lòng chọn phương thức");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleOk = async () => {
    if (!invoice) return;
    if (!validate()) return;

    try {
      await recordPayment.mutateAsync({
        id: invoice.id,
        data: {
          amount: Number(amount),
          currency: invoice.currency,
          method: Number(method) as PaymentMethod,
          reference: reference.trim() || undefined,
        },
      });
      toast.success(t("Đã ghi nhận thanh toán"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[460px]">
        <DialogHeader>
          <DialogTitle>{t("Ghi nhận thanh toán")}</DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="pay-summary">
            <div className="pay-summary-row">
              <span>{t("Phiếu")}</span>
              <strong>{invoice.invoiceNumber}</strong>
            </div>
            <div className="pay-summary-row">
              <span>{t("Khách hàng")}</span>
              <strong>{invoice.patientName || "—"}</strong>
            </div>
            <div className="pay-summary-row">
              <span>{t("Còn lại")}</span>
              <strong className="pay-summary-due">{formatVND(outstanding)}</strong>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Số tiền")}</label>
            <Input
              type="number"
              min={0}
              step={50000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {errors.amount && <p className="text-xs text-destructive mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t("Phương thức thanh toán")}</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder={t("Chọn phương thức")} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(methodLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.method && <p className="text-xs text-destructive mt-1">{errors.method}</p>}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t("Mã tham chiếu")}</label>
            <Input
              placeholder={t("Số giao dịch, mã chuyển khoản...")}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("Huỷ")}</Button>
          <Button onClick={() => void handleOk()} disabled={recordPayment.isPending}>
            {recordPayment.isPending ? t("Đang xử lý...") : t("Xác nhận thanh toán")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
