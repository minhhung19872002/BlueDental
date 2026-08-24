import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, Download, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/vi";
import { useCareRecordList } from "../api/careApi";
import type { CareType as ApiCareType, CareStatus } from "../api/careApi";
import { useDebounce } from "@/hooks/useDebounce";
import { DateNavigator } from "@/components/DateNavigator";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { useForm } from "react-hook-form";

dayjs.locale("vi");

// ── Types ──────────────────────────────────────────────────────────────────

type TopTab = "care" | "grouping";
type ViewMode = "day" | "week" | "month";
type StatusFilter =
  | "total"
  | "success"
  | "failed"
  | "not-cared"
  | "zalo-sent";
type CareType =
  | "after-treatment"
  | "birthday"
  | "appointment-reminder"
  | "periodic"
  | "special";

// ── Static maps (keys only, labels resolved via t()) ──────────────────────

const CARE_TYPE_MAP: Record<CareType, ApiCareType> = {
  "after-treatment": "AfterTreatment",
  "birthday": "Birthday",
  "appointment-reminder": "AppointmentReminder",
  "periodic": "Periodic",
  "special": "Special",
};

const STATUS_MAP: Record<StatusFilter, CareStatus | undefined> = {
  "total": undefined,
  "success": "Completed",
  "failed": "Cancelled",
  "not-cared": "Pending",
  "zalo-sent": undefined,
};

// ── Component ──────────────────────────────────────────────────────────────

export function CskhGroupingPage() {
  const [topTab, setTopTab] = useState<TopTab>("care");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState<Dayjs>(dayjs());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("total");
  const [careType, setCareType] = useState<CareType>("after-treatment");
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebounce(keyword);

  const TOP_TABS: { key: TopTab; label: string }[] = [
    { key: "care",     label: t("Chăm sóc khách hàng") },
    { key: "grouping", label: t("Phân nhóm CSKH") },
  ];

  const VIEW_MODES: { key: ViewMode; label: string }[] = [
    { key: "day",   label: t("Ngày") },
    { key: "week",  label: t("Tuần") },
    { key: "month", label: t("Tháng") },
  ];

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "total",     label: t("Tổng khách") },
    { key: "success",   label: t("Thành công") },
    { key: "failed",    label: t("Thất bại") },
    { key: "not-cared", label: t("Chưa CS") },
    { key: "zalo-sent", label: t("Đã gửi Zalo") },
  ];

  const CARE_TYPES: { key: CareType; label: string }[] = [
    { key: "after-treatment",      label: t("Sau điều trị") },
    { key: "birthday",             label: t("Chúc mừng sinh nhật") },
    { key: "appointment-reminder", label: t("Nhắc lịch hẹn") },
    { key: "periodic",             label: t("CSKH định kì") },
    { key: "special",              label: t("CSKH đặc biệt") },
  ];

  const { data: careData, isLoading: careLoading } = useCareRecordList({
    type: CARE_TYPE_MAP[careType],
    status: STATUS_MAP[statusFilter],
    filter: debouncedKeyword || undefined,
    maxResultCount: 50,
  });

  const careRecords = careData?.items ?? [];

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Chăm sóc khách hàng")}
        subtitle={t("Phân nhóm nhật ký chăm sóc theo mục đích liên hệ")}
      />

      {/* Top-level tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {TOP_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTopTab(tab.key)}
              style={{
                padding: "8px 20px",
                border: "none",
                borderBottom: topTab === tab.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: topTab === tab.key ? "#1677ff" : "#595959",
                fontWeight: topTab === tab.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar row 1: date navigation */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SegmentedControl
            options={VIEW_MODES}
            value={viewMode}
            onChange={setViewMode}
          />
          <DateNavigator
            value={currentDate}
            mode={viewMode}
            onChange={setCurrentDate}
          />
        </div>
      </div>

      {/* Status counter buttons */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((sf) => {
            const count = sf.key === "total" ? (careData?.totalCount ?? 0)
              : sf.key === "success" ? careRecords.filter(r => r.status === "Completed").length
              : sf.key === "failed" ? careRecords.filter(r => r.status === "Cancelled").length
              : sf.key === "not-cared" ? careRecords.filter(r => r.status === "Pending").length
              : 0;
            return (
              <button
                key={sf.key}
                onClick={() => setStatusFilter(sf.key)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 20,
                  border: "1px solid",
                  borderColor: statusFilter === sf.key ? "#1677ff" : "#d9d9d9",
                  background: statusFilter === sf.key ? "#e6f4ff" : "#fff",
                  color: statusFilter === sf.key ? "#1677ff" : "#595959",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: statusFilter === sf.key ? 600 : 400,
                }}
              >
                {count} {sf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Care type tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {CARE_TYPES.map((ct) => (
            <button
              key={ct.key}
              onClick={() => setCareType(ct.key)}
              style={{
                padding: "8px 16px",
                border: "none",
                borderBottom: careType === ct.key ? "2px solid #1677ff" : "2px solid transparent",
                background: "none",
                color: careType === ct.key ? "#1677ff" : "#595959",
                fontWeight: careType === ct.key ? 600 : 400,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar row 2 */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button variant="outline">
            <Download size={14} className="mr-1.5" />
            {t("Xuất Excel")}
          </Button>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("Tìm kiếm...")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-8 w-56"
            />
          </div>
          <Select>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("Bác sĩ điều trị")} />
            </SelectTrigger>
            <SelectContent>
              {/* options */}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab content */}
      {topTab === "care" && (
        <div className="reception-card reception-card--content">
          {careLoading ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Ngày chăm sóc")}</TableHead>
                    <TableHead>{t("Họ và tên")}</TableHead>
                    <TableHead>{t("Số điện thoại")}</TableHead>
                    <TableHead>{t("Bác sĩ điều trị")}</TableHead>
                    <TableHead>{t("Lịch hẹn sắp tới")}</TableHead>
                    <TableHead>{t("Trạng thái")}</TableHead>
                    <TableHead>{t("Ghi chú")}</TableHead>
                    <TableHead>{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {careRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        {t("Không có dữ liệu")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    careRecords.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.dueAt ? dayjs(r.dueAt).format("DD/MM/YYYY") : dayjs(r.creationTime).format("DD/MM/YYYY")}</TableCell>
                        <TableCell>{r.patientName ?? "—"}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell>
                          {r.status ? (
                            <span className="text-xs px-2 py-0.5 rounded bg-muted">{r.status}</span>
                          ) : null}
                        </TableCell>
                        <TableCell>{r.description ?? "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">{t("Chi tiết")}</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {topTab === "grouping" && <CskhGroupingPanel />}
    </div>
  );
}

import {
  useCskhGroupList,
  useCreateCskhGroup,
  useUpdateCskhGroup,
  useDeleteCskhGroup,
  type CskhGroupDto,
} from "../api/cskhGroupApi";

interface GroupFormValues {
  name: string;
  criteria?: string;
  description?: string;
}

function CskhGroupingPanel() {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CskhGroupDto | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GroupFormValues>();

  const { data, isLoading } = useCskhGroupList();
  const createMutation = useCreateCskhGroup();
  const updateMutation = useUpdateCskhGroup();
  const deleteMutation = useDeleteCskhGroup();
  const isEdit = Boolean(editingItem);

  const filtered = (data?.items ?? []).filter((g) =>
    !keyword || g.name.toLowerCase().includes(keyword.toLowerCase()),
  );

  const openCreate = () => {
    setEditingItem(null);
    reset({ name: "", criteria: "", description: "" });
    setModalOpen(true);
  };

  const openEdit = (item: CskhGroupDto) => {
    setEditingItem(item);
    reset({ name: item.name, criteria: item.criteria ?? "", description: item.description ?? "" });
    setModalOpen(true);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (isEdit && editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, data: values });
      toast.success(t("Cập nhật nhóm thành công"));
    } else {
      await createMutation.mutateAsync(values);
      toast.success(t("Tạo nhóm thành công"));
    }
    reset();
    setEditingItem(null);
    setModalOpen(false);
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Xóa thành công"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("Tìm nhóm CSKH...")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-8 w-64"
            />
          </div>
          <Button className="ml-auto" onClick={openCreate}>
            <Plus size={14} className="mr-1.5" />
            {t("Tạo nhóm mới")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--content">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">{t("Tên nhóm")}</TableHead>
                <TableHead>{t("Tiêu chí phân nhóm")}</TableHead>
                <TableHead className="w-28">{t("Trạng thái")}</TableHead>
                <TableHead className="w-28">{t("Ngày")}</TableHead>
                <TableHead className="w-36">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t("Chưa có nhóm CSKH nào")}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell><span className="font-medium">{g.name}</span></TableCell>
                    <TableCell>{g.criteria ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${g.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {g.isActive ? t("Đang dùng") : t("Tạm dừng")}
                      </span>
                    </TableCell>
                    <TableCell>{g.creationTime ? dayjs(g.creationTime).format("DD/MM/YYYY") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(g)}>
                          <Pencil size={14} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="h-7 w-7 p-0">
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("Xóa nhóm CSKH?")}</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => handleDelete(g.id)}
                              >
                                {t("Xóa")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { reset(); setEditingItem(null); setModalOpen(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? t("Chỉnh sửa nhóm CSKH") : t("Tạo nhóm CSKH mới")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("Tên nhóm")} <span className="text-destructive">*</span></label>
              <Input
                placeholder={t("Nhập tên nhóm")}
                {...register("name", { required: t("Nhập tên nhóm") })}
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("Tiêu chí phân nhóm")}</label>
              <textarea
                rows={2}
                placeholder={t("Nhập tiêu chí phân nhóm")}
                {...register("criteria")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t("Mô tả")}</label>
              <textarea
                rows={2}
                placeholder={t("Mô tả")}
                {...register("description")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setEditingItem(null); setModalOpen(false); }}>{t("Hủy")}</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
                {isEdit ? t("Lưu") : t("Tạo nhóm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
