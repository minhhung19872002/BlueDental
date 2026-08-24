import { useState } from "react";
import { Search } from "lucide-react";
import dayjs from "dayjs";
import { useAuditLogList, type AuditLogDto } from "../api";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
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

const HTTP_METHOD_BG: Record<string, string> = {
  GET: "#dbeafe",
  POST: "#dcfce7",
  PUT: "#ffedd5",
  PATCH: "#cffafe",
  DELETE: "#fee2e2",
};
const HTTP_METHOD_COLOR: Record<string, string> = {
  GET: "#1d4ed8",
  POST: "#15803d",
  PUT: "#c2410c",
  PATCH: "#0e7490",
  DELETE: "#b91c1c",
};

function statusColors(code?: number): { bg: string; color: string } {
  if (!code) return { bg: "#f3f4f6", color: "#374151" };
  if (code < 300) return { bg: "#dcfce7", color: "#15803d" };
  if (code < 400) return { bg: "#dbeafe", color: "#1d4ed8" };
  if (code < 500) return { bg: "#ffedd5", color: "#c2410c" };
  return { bg: "#fee2e2", color: "#b91c1c" };
}

export function AuditLogPage() {
  const [userName, setUserName] = useState("");
  const [httpMethod, setHttpMethod] = useState<string | undefined>();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data, isLoading } = useAuditLogList({
    userName: userName || undefined,
    httpMethod: httpMethod || undefined,
    startTime: startDate ? dayjs(startDate).toISOString() : undefined,
    endTime: endDate ? dayjs(endDate).toISOString() : undefined,
  });

  const rows: AuditLogDto[] = data?.items ?? [];

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Nhật ký hệ thống")}
        subtitle={t("Lịch sử thao tác trên toàn hệ thống")}
      />

      <div className="reception-card reception-card--toolbar">
        <div style={{ fontWeight: 700, fontSize: 18, color: "#1B2A41", marginBottom: 4 }}>
          {t("Nhật ký hoạt động")}
        </div>
        <div style={{ fontSize: 13, color: "#5A6B82" }}>
          {t("Lịch sử các thao tác trong hệ thống")}
        </div>
      </div>

      <div className="reception-card reception-card--toolbar">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("Tên người dùng...")}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="pl-8 w-48"
            />
          </div>
          <Select value={httpMethod ?? ""} onValueChange={(v) => setHttpMethod(v || undefined)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t("Phương thức HTTP")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t("Tất cả")}</SelectItem>
              {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePickerInput
            value={startDate}
            onChange={setStartDate}
            className="w-40"
            placeholder="Từ ngày"
          />
          <DatePickerInput
            value={endDate}
            onChange={setEndDate}
            className="w-40"
            placeholder="Đến ngày"
          />
        </div>
      </div>

      <div className="reception-card reception-card--content overflow-x-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Không có dữ liệu nhật ký")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">{t("Thời gian")}</TableHead>
                <TableHead className="w-36">{t("Người dùng")}</TableHead>
                <TableHead className="w-24">{t("Phương thức")}</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-28">HTTP Status</TableHead>
                <TableHead className="w-32">{t("Thời gian xử lý")}</TableHead>
                <TableHead className="w-32">IP</TableHead>
                <TableHead className="w-20">{t("Lỗi")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const mBg = HTTP_METHOD_BG[row.httpMethod ?? ""] ?? "#f3f4f6";
                const mColor = HTTP_METHOD_COLOR[row.httpMethod ?? ""] ?? "#374151";
                const sc = statusColors(row.httpStatusCode);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {dayjs(row.executionTime).format("DD/MM/YYYY HH:mm:ss")}
                    </TableCell>
                    <TableCell>{row.userName ?? "—"}</TableCell>
                    <TableCell>
                      {row.httpMethod ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: mBg, color: mColor }}
                        >
                          {row.httpMethod}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      <span style={{ fontFamily: "monospace", fontSize: 12 }}>{row.url ?? "—"}</span>
                    </TableCell>
                    <TableCell>
                      {row.httpStatusCode ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{ background: sc.bg, color: sc.color }}
                        >
                          {row.httpStatusCode}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>{row.executionDuration} ms</TableCell>
                    <TableCell>{row.clientIpAddress ?? "—"}</TableCell>
                    <TableCell>
                      {row.exceptions ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                          {t("Có lỗi")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          OK
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
