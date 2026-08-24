import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Check,
  Clock,
  RefreshCw,
  Loader2,
} from "lucide-react";
import type { ReceptionItem, ReceptionStatus, RefType } from "../types/reception";
import { t } from "@/lib/i18n";

interface ReceptionTableProps {
  items: ReceptionItem[];
  loading?: boolean;
  onStatusChange: (id: string, newStatus: ReceptionStatus) => void;
  onRowClick?: (item: ReceptionItem) => void;
}

const refTypeLabels: Record<RefType, { label: string; className: string }> = {
  Medical:   { label: "Y tế",      className: "bg-purple-100 text-purple-700" },
  Self:      { label: "Tự đến",    className: "bg-blue-100 text-blue-700" },
  Referral:  { label: "Giới thiệu", className: "bg-cyan-100 text-cyan-700" },
  Marketing: { label: "Marketing", className: "bg-indigo-100 text-indigo-700" },
};

export const ReceptionTable: React.FC<ReceptionTableProps> = ({
  items,
  loading = false,
  onStatusChange,
  onRowClick,
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-36">{t("Số phiếu")}</TableHead>
            <TableHead className="w-56">{t("Bệnh nhân")}</TableHead>
            <TableHead className="w-44">{t("Bác sĩ tiếp nhận")}</TableHead>
            <TableHead className="w-40">{t("Nhân sự tư vấn")}</TableHead>
            <TableHead className="w-32">{t("Nguồn tiếp nhận")}</TableHead>
            <TableHead className="w-36">{t("Trạng thái")}</TableHead>
            <TableHead className="w-48">{t("Dịch vụ điều trị")}</TableHead>
            <TableHead className="w-36 text-right">{t("Tổng tiền")}</TableHead>
            <TableHead className="w-36 text-center">{t("Thao tác")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-12 text-center">
                <div className="text-3xl mb-2">📋</div>
                <p className="font-semibold text-muted-foreground">{t("Danh sách trống")}</p>
                <p className="text-sm text-muted-foreground">{t("Không tìm thấy hồ sơ tiếp nhận nào phù hợp với bộ lọc.")}</p>
              </TableCell>
            </TableRow>
          ) : (
            items.map((record) => (
              <TableRow
                key={record.id}
                onClick={() => onRowClick?.(record)}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {/* Số phiếu */}
                <TableCell>
                  <span className="font-semibold font-mono text-[#2671D8]">{record.voucherCode}</span>
                </TableCell>

                {/* Bệnh nhân */}
                <TableCell>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="font-semibold text-[#0F172A]">{record.patientName}</span>
                    {record.patientType === "New" ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">{t("Mới")}</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{t("Cũ")}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{record.patientPhone}</div>
                </TableCell>

                {/* Bác sĩ tiếp nhận */}
                <TableCell>
                  <span className="font-medium text-[#334155]">{record.doctorName}</span>
                </TableCell>

                {/* Nhân sự tư vấn */}
                <TableCell>
                  <span className="text-sm text-muted-foreground">{record.adviseDoctorName ?? t("Chưa phân công")}</span>
                </TableCell>

                {/* Nguồn tiếp nhận */}
                <TableCell>
                  {(() => {
                    const conf = refTypeLabels[record.refType as RefType] ?? { label: record.refType, className: "bg-gray-100 text-gray-600" };
                    return (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${conf.className}`}>
                        {conf.label}
                      </span>
                    );
                  })()}
                </TableCell>

                {/* Trạng thái */}
                <TableCell>
                  {record.status === "WaitingForExam" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                      <Clock size={12} /> {t("Chờ khám")}
                    </span>
                  )}
                  {record.status === "InProgress" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                      <RefreshCw size={12} /> {t("Đang khám")}
                    </span>
                  )}
                  {record.status === "Completed" && (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      <Check size={12} /> {t("Hoàn thành")}
                    </span>
                  )}
                  {!["WaitingForExam", "InProgress", "Completed"].includes(record.status) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{record.status}</span>
                  )}
                </TableCell>

                {/* Dịch vụ điều trị */}
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(record.services ?? []).map((s: string, idx: number) => (
                      <span key={idx} className="text-xs px-2 py-0.5 rounded-full border border-border bg-gray-50">{s}</span>
                    ))}
                  </div>
                </TableCell>

                {/* Tổng tiền */}
                <TableCell className="text-right">
                  <span className="font-semibold text-[#0F172A]">{record.totalDue.toLocaleString("vi-VN")} đ</span>
                </TableCell>

                {/* Thao tác */}
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    {record.status === "WaitingForExam" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-[#2671D8] hover:bg-[#1c5bb8]"
                        title={t("Chuyển vào khám")}
                        onClick={() => onStatusChange(record.id, "InProgress")}
                      >
                        {t("Tiếp nhận")}
                      </Button>
                    )}
                    {record.status === "InProgress" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-[#10B981] hover:bg-[#0e9f72]"
                        title={t("Hoàn thành dịch vụ")}
                        onClick={() => onStatusChange(record.id, "Completed")}
                      >
                        {t("Xong")}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <MoreHorizontal size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={record.status === "InProgress" || record.status === "Completed"}
                          onClick={() => onStatusChange(record.id, "InProgress")}
                        >
                          {t("Chuyển sang Đang khám")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={record.status === "Completed"}
                          onClick={() => onStatusChange(record.id, "Completed")}
                        >
                          {t("Kết thúc điều trị (Hoàn thành)")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>{t("Sửa ghi chú")}</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">{t("Xoá ghi chú")}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
