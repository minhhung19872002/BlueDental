import { useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  staffKeys,
  useCreateStaff,
  useDeleteStaff,
  useStaffList,
  useStaffRoleNames,
  useUpdateStaff,
} from "../api/staffQueries";
import { staffApi, type StaffDto } from "../api/staffApi";
import { useDebounce } from "@/hooks/useDebounce";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { StaffEditorModal, type StaffFormValues } from "../components/StaffEditorModal";
import { useClinicBranches } from "@/features/organizations/api";

type StatusFilter = "all" | "working" | "resigned";

const STATUS_TABS: { key: StatusFilter; label: () => string }[] = [
  { key: "all", label: () => t("Tất cả") },
  { key: "working", label: () => t("Đang làm việc") },
  { key: "resigned", label: () => t("Đã nghỉ") },
];

export function StaffPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StaffDto | null>(null);

  const queryClient = useQueryClient();
  const debouncedKeyword = useDebounce(keyword);

  const { data, isLoading } = useStaffList({
    filter: debouncedKeyword || undefined,
    skipCount: (page - 1) * pageSize,
    maxResultCount: pageSize,
  });
  const { data: roleNames } = useStaffRoleNames();

  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const rows = (data?.items ?? []).filter((staff) =>
    statusFilter === "all"
      ? true
      : statusFilter === "working"
        ? staff.isActive
        : !staff.isActive,
  );

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (staff: StaffDto) => {
    setEditing(staff);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStaff.mutateAsync(deleteTarget.id);
      toast.success(t("Đã xoá nhân viên"));
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSubmit = async (values: StaffFormValues, avatarFile?: File | null | undefined) => {
    const extraFields = {
      address: values.address || undefined,
      provinceId: values.provinceId || undefined,
      wardId: values.wardId || undefined,
      isDentist: values.isDentist,
      isAssistant: values.isAssistant,
      isHygienist: values.isHygienist,
      morningStartTime: values.morningStartTime || undefined,
      morningEndTime: values.morningEndTime || undefined,
      afternoonStartTime: values.afternoonStartTime || undefined,
      afternoonEndTime: values.afternoonEndTime || undefined,
    };

    try {
      let staffId: string;
      if (editing) {
        await updateStaff.mutateAsync({
          id: editing.id,
          data: {
            name: values.name,
            email: values.email,
            phoneNumber: values.phoneNumber || undefined,
            isActive: values.isActive,
            roleNames: values.roleNames,
            branchIds: values.branchIds,
            ...extraFields,
          },
        });
        staffId = editing.id;
      } else {
        const result = await createStaff.mutateAsync({
          userName: values.email.split("@")[0],
          password: values.password,
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber || undefined,
          roleNames: values.roleNames,
          branchIds: values.branchIds,
          ...extraFields,
        });
        staffId = result.id;
      }

      setModalOpen(false);
      toast.success(editing ? t("Đã cập nhật nhân viên") : t("Đã tạo nhân viên"));

      if (avatarFile instanceof File) {
        staffApi.uploadAvatar(staffId, avatarFile).then(
          () => void queryClient.invalidateQueries({ queryKey: staffKeys.all }),
          (err) => toast.error(extractApiError(err, t("Tải ảnh đại diện thất bại"))),
        );
      } else if (avatarFile === null && editing?.avatarUrl) {
        staffApi.deleteAvatar(staffId).then(
          () => void queryClient.invalidateQueries({ queryKey: staffKeys.all }),
          (err) => toast.error(extractApiError(err, t("Xóa ảnh đại diện thất bại"))),
        );
      }
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const { data: branches } = useClinicBranches();
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));

  const columns: DataTableColumn<StaffDto>[] = [
    {
      key: "fullName",
      title: t("Tên"),
      width: 240,
      render: (_, record) => (
        <span className="text-[13px] text-[#374151]">
          {record.fullName || record.userName}
        </span>
      ),
    },
    {
      key: "phoneNumber",
      title: t("Số điện thoại"),
      dataIndex: "phoneNumber",
      width: 180,
      render: (v) => (
        <span className="text-[13px] text-[#374151]">{(v as string) || "—"}</span>
      ),
    },
    {
      key: "email",
      title: "Email",
      dataIndex: "email",
      width: 280,
      render: (v) => (
        <span className="text-[13px] text-[#374151]">{(v as string) || "—"}</span>
      ),
    },
    {
      key: "roleNames",
      title: t("Phân quyền"),
      dataIndex: "roleNames",
      width: 200,
      render: (v) => (
        <span className="text-[13px] text-[#374151]">
          {(v as string[])?.length > 0 ? (v as string[]).join(", ") : "—"}
        </span>
      ),
    },
    {
      key: "address",
      title: t("Địa chỉ"),
      width: 350,
      render: (_, record) => (
        <span className={`text-[13px] ${record.address ? "text-[#374151]" : "text-[#9CA3AF]"}`}>
          {record.address || "—"}
        </span>
      ),
    },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 110,
      align: "center",
      render: (_, record) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#374151]"
                onClick={(e) => { e.stopPropagation(); openEdit(record); }}
              >
                <Pencil className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("Chỉnh sửa")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-8 items-center justify-center rounded-md text-[#EF4444] transition-colors hover:bg-red-50 hover:text-[#DC2626]"
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(record); }}
              >
                <Trash2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("Xoá")}</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: search + create button */}
      <div className="rounded-2xl border border-[var(--bd-border)] bg-white px-4 py-2.5 shadow-[var(--bd-shadow-card)]">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
            <Input
              className="pl-9"
              placeholder={t("Tìm theo tên, email, số điện thoại...")}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-1 size-4" />
            {t("Tạo")}
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div>
        <div className="reception-status-pills w-fit bg-white!">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`reception-status-pill ${statusFilter === tab.key ? "reception-status-pill--active" : ""}`}
              onClick={() => setStatusFilter(tab.key)}
            >
              {tab.label()}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--bd-border)] bg-white shadow-[var(--bd-shadow-card)]">
        <DataTable<StaffDto>
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={isLoading}
          emptyText={t("Chưa có nhân viên")}
          pagination={{
            current: page,
            pageSize,
            total: data?.totalCount ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            itemLabel: t("nhân viên"),
            onChange: (p, ps) => {
              if (ps !== pageSize) {
                setPageSize(ps);
                setPage(1);
              } else {
                setPage(p);
              }
            },
          }}
        />
      </div>

      <StaffEditorModal
        open={modalOpen}
        staff={editing}
        roleNames={roleNames ?? []}
        branchOptions={branchOptions}
        loading={createStaff.isPending || updateStaff.isPending}
        onSubmit={(v, avatar) => void handleSubmit(v, avatar)}
        onClose={() => setModalOpen(false)}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Xoá nhân viên này?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.fullName || deleteTarget?.userName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Huỷ")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              {t("Xoá")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
