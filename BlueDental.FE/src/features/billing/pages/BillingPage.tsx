import { useState } from "react";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  INVOICE_STATUS,
  invoiceStatusConfig,
  useInvoiceList,
  type InvoiceDto,
  type InvoiceStatus,
} from "../api";
import { PaymentModal } from "../components/PaymentModal";
import { PageHeader } from "@/components/PageHeader";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { downloadFile } from "@/lib/download";
import { extractApiError } from "@/lib/apiError";
import { formatDate, formatVND } from "@/utils/format";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** An invoice that is still owed money and may still be collected against. */
function isCollectable(row: InvoiceDto): boolean {
  return (
    row.balanceDue > 0 &&
    row.status !== INVOICE_STATUS.Voided &&
    row.status !== INVOICE_STATUS.Draft &&
    row.status !== INVOICE_STATUS.Refunded
  );
}

/**
 * Thanh toán & hoá đơn.
 *
 * The three cards sum the page on screen, not the clinic: the invoice endpoint
 * returns a page and a count, never an aggregate, so the labels say "trên trang
 * này" rather than implying a figure the server never sent.
 */
export function BillingPage() {
  const branchId = useCurrentBranchId();
  const pagination = useTablePagination(20);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | undefined>();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [paying, setPaying] = useState<InvoiceDto | null>(null);

  const listParams = {
    branchId,
    status: statusFilter,
    filter: debouncedSearch || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  };

  const { data, isLoading } = useInvoiceList(listParams);
  const statusLook = invoiceStatusConfig();

  const rows = data?.items ?? [];
  const total = rows.reduce((sum, row) => sum + row.totalAmount, 0);
  const paid = rows.reduce((sum, row) => sum + row.paidAmount, 0);
  const outstanding = rows.reduce((sum, row) => sum + row.balanceDue, 0);

  const handleExport = async () => {
    try {
      await downloadFile("/v1/app/invoices/excel", "hoa-don.xlsx", {
        branchId,
        status: statusFilter,
        filter: debouncedSearch || undefined,
      });
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title={t("Thanh toán & hoá đơn")}
        subtitle={t("Bấm "Thu tiền" để ghi nhận thanh toán từng phiếu")}
        actions={
          <Button variant="outline" onClick={() => void handleExport()}>
            <ExternalLink size={14} className="mr-1" />
            {t("Xuất Excel")}
          </Button>
        }
      />

      <div className="billing-kpis">
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Tổng giá trị hoá đơn")}</div>
          <div className="billing-kpi-value">{formatVND(total)}</div>
          <div className="billing-kpi-caption">{t("trên trang này")}</div>
        </div>
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Đã thu")}</div>
          <div className="billing-kpi-value" style={{ color: brand.green }}>
            {formatVND(paid)}
          </div>
          <div className="billing-kpi-caption">{t("trên trang này")}</div>
        </div>
        <div className="page-card billing-kpi">
          <div className="billing-kpi-label">{t("Công nợ còn lại")}</div>
          <div className="billing-kpi-value" style={{ color: brand.red }}>
            {formatVND(outstanding)}
          </div>
          <div className="billing-kpi-caption">{t("trên trang này")}</div>
        </div>
      </div>

      <div className="page-card billing-toolbar">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 max-w-[280px]"
            placeholder={t("Tìm theo mã phiếu...")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              pagination.resetToFirstPage();
            }}
          />
        </div>
        <Select
          value={statusFilter !== undefined ? String(statusFilter) : ""}
          onValueChange={(v) => {
            setStatusFilter(v ? (Number(v) as InvoiceStatus) : undefined);
            pagination.resetToFirstPage();
          }}
        >
          <SelectTrigger className="min-w-[190px]">
            <SelectValue placeholder={t("Trạng thái")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("Tất cả")}</SelectItem>
            {Object.entries(statusLook).map(([value, look]) => (
              <SelectItem key={value} value={value}>{look.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="page-card billing-table-card">
        {isLoading ? (
          <div className="billing-loading flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Chưa có hoá đơn")}</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">{t("Mã phiếu")}</TableHead>
                  <TableHead>{t("Khách hàng")}</TableHead>
                  <TableHead className="w-28">{t("Ngày")}</TableHead>
                  <TableHead className="w-32 text-right">{t("Tổng tiền")}</TableHead>
                  <TableHead className="w-32 text-right">{t("Đã thu")}</TableHead>
                  <TableHead className="w-32 text-right">{t("Còn lại")}</TableHead>
                  <TableHead className="w-36">{t("Trạng thái")}</TableHead>
                  <TableHead className="w-40">{t("Thao tác")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const look = statusLook[row.status];
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <strong style={{ color: brand.blue }}>{row.invoiceNumber}</strong>
                      </TableCell>
                      <TableCell>{row.patientName || "—"}</TableCell>
                      <TableCell>{formatDate(row.issuedAt)}</TableCell>
                      <TableCell className="text-right">
                        <strong>{formatVND(row.totalAmount)}</strong>
                      </TableCell>
                      <TableCell className="text-right">
                        <span style={{ color: brand.green, fontWeight: 600 }}>
                          {formatVND(row.paidAmount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span style={{ color: row.balanceDue > 0 ? brand.red : brand.faint, fontWeight: 600 }}>
                          {formatVND(row.balanceDue)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ color: look.color, background: `${look.color}16` }}
                        >
                          {look.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={!isCollectable(row)}
                          onClick={() => setPaying(row)}
                        >
                          {t("Thu tiền")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <PaymentModal
        open={paying !== null}
        invoice={paying}
        onClose={() => setPaying(null)}
      />
    </div>
  );
}
