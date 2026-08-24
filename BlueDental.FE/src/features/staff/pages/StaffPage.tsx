import { useState } from "react";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateStaff,
  useDeleteStaff,
  useStaffList,
  useStaffRoleNames,
  useUpdateStaff,
} from "../api/staffQueries";
import type { StaffDto } from "../api/staffApi";
import { StaffRosterCard, accentFor } from "../components/StaffRosterCard";
import { useWeekRoster, weekStartOf } from "../api/rosterQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import dayjs from "dayjs";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusFilter = "all" | "working" | "resigned";

const statusTabs = (): { key: StatusFilter; label: string }[] => [
  { key: "all", label: t("Tất cả") },
  { key: "working", label: t("Đang làm việc") },
  { key: "resigned", label: t("Đã nghỉ") },
];

interface StaffFormValues {
  userName: string;
  password: string;
  name: string;
  email: string;
  phoneNumber: string;
  roleNames: string[];
}

/**
 * Nhân viên.
 *
 * Staff are ABP identity users, so creating one means creating an account: the
 * login name and the initial password belong to the form, and roles decide what
 * the account may do.
 */
export function StaffPage() {
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<StaffFormValues>({ userName: "", password: "", name: "", email: "", phoneNumber: "", roleNames: [] });

  const debouncedKeyword = useDebounce(keyword);

  const { data, isLoading } = useStaffList({
    filter: debouncedKeyword || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const { data: roleNames } = useStaffRoleNames();

  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const branchId = useCurrentBranchId();
  const { daysFor } = useWeekRoster(branchId, weekStartOf(dayjs()));

  const handleDelete = async (staff: StaffDto) => {
    try {
      await deleteStaff.mutateAsync(staff.id);
      toast.success(t("Đã xoá nhân viên"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  // Identity has no "resigned" flag of its own — an inactive account is one.
  const rows = (data?.items ?? []).filter((staff) =>
    statusFilter === "all"
      ? true
      : statusFilter === "working"
        ? staff.isActive
        : !staff.isActive,
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ userName: "", password: "", name: "", email: "", phoneNumber: "", roleNames: [] });
    setModalOpen(true);
  };

  const openEdit = (staff: StaffDto) => {
    setEditing(staff);
    setForm({
      userName: staff.userName,
      password: "",
      name: staff.fullName || staff.name || "",
      email: staff.email ?? "",
      phoneNumber: staff.phoneNumber ?? "",
      roleNames: staff.roleNames,
    });
    setModalOpen(true);
  };

  const setField = <K extends keyof StaffFormValues>(key: K, value: StaffFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await updateStaff.mutateAsync({
          id: editing.id,
          data: {
            name: form.name,
            email: form.email,
            phoneNumber: form.phoneNumber,
            isActive: editing.isActive,
            roleNames: form.roleNames,
            branchIds: editing.branchIds,
          },
        });
        toast.success(t("Đã cập nhật nhân viên"));
      } else {
        await createStaff.mutateAsync({
          userName: form.userName,
          password: form.password,
          name: form.name,
          email: form.email,
          phoneNumber: form.phoneNumber,
          roleNames: form.roleNames,
          branchIds: [],
        });
        toast.success(t("Đã tạo nhân viên"));
      }

      setModalOpen(false);
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <div className="reception-page">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t("Nhân sự & lịch làm việc")}</h1>
          <p className="page-header-subtitle">
            {t("Bấm vào ngày để bật/tắt ca trực trong tuần")}
          </p>
        </div>
      </div>

      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8 w-80"
              placeholder={t("Tìm theo tên, email, số điện thoại...")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Button onClick={openCreate}>
            <Plus size={14} className="mr-1" />
            {t("Tạo")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {statusTabs().map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`reception-status-pill ${statusFilter === tab.key ? "reception-status-pill--active" : ""}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="page-card flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="page-card py-8 text-center text-muted-foreground">
          {t("Chưa có nhân viên")}
        </div>
      ) : (
        <div className="staff-grid">
          {rows.map((staff, i) => (
            <StaffRosterCard
              key={staff.id}
              staff={staff}
              accent={accentFor(i)}
              days={daysFor(staff.id)}
              clinicBranchId={branchId}
              onEdit={() => openEdit(staff)}
              onDelete={() => void handleDelete(staff)}
            />
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("Chỉnh sửa nhân viên") : t("Tạo nhân viên")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("Tên đăng nhập")} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="letan01"
                value={form.userName}
                onChange={(e) => setField("userName", e.target.value)}
                disabled={Boolean(editing)}
              />
            </div>

            {!editing && (
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t("Mật khẩu")} <span className="text-destructive">*</span>
                </label>
                <Input
                  type="password"
                  placeholder={t("Mật khẩu đăng nhập")}
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("Tối thiểu 8 ký tự, có chữ hoa, số và ký tự đặc biệt.")}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Họ và tên")}</label>
              <Input
                placeholder="Nguyễn Văn An"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Email <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                placeholder="letan01@bluedental.vn"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Số điện thoại")}</label>
              <Input
                placeholder="09xxxxxxxx"
                value={form.phoneNumber}
                onChange={(e) => setField("phoneNumber", e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Vai trò")}</label>
              <Select
                value={form.roleNames[0] ?? ""}
                onValueChange={(v) => setField("roleNames", v ? [v] : [])}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("Chọn vai trò")} />
                </SelectTrigger>
                <SelectContent>
                  {(roleNames ?? []).map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {t("Hiện tại chỉ chọn được 1 vai trò. Nhiều vai trò sẽ được hỗ trợ sau.")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t("Huỷ")}</Button>
            <Button onClick={() => void handleSubmit()} disabled={createStaff.isPending || updateStaff.isPending}>
              {editing ? t("Lưu") : t("Tạo")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
