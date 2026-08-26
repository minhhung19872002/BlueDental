import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Button,
  Input,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
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
import { StaffEditorModal, type StaffFormValues } from "../components/StaffEditorModal";
import { useClinicBranches } from "@/features/organizations/api";
import { useBranchStore } from "@/lib/clinicBranch";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";

import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PageHeader } from "@/components/PageHeader";
import { DataTable } from "@/components/DataTable";
import { MobileFilterDrawer } from "@/components/MobileFilterDrawer";
import { t } from "@/lib/i18n";

type StatusFilter = "all" | "working" | "resigned";

const statusTabs = (): { key: StatusFilter; label: string }[] => [
  { key: "all", label: t("Tất cả") },
  { key: "working", label: t("Đang làm việc") },
  { key: "resigned", label: t("Đã nghỉ") },
];

export function StaffPage() {
  const queryClient = useQueryClient();
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<StaffDto | null>(null);

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");

  const debouncedKeyword = useDebounce(keyword);
  const currentBranchId = useBranchStore((s) => s.currentBranchId);

  const isActiveParam =
    statusFilter === "all" ? undefined : statusFilter === "working";

  useEffect(() => {
    pagination.resetToFirstPage();
  }, [debouncedKeyword, statusFilter, currentBranchId]);

  const { data, isLoading } = useStaffList({
    filter: debouncedKeyword.trim() || undefined,
    isActive: isActiveParam,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
    branchId: currentBranchId ?? undefined,
  });
  const { data: roleNames } = useStaffRoleNames();
  const { data: branches } = useClinicBranches();
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));

  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const rows = data?.items ?? [];

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (staff: StaffDto) => {
    setEditing(staff);
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteStaff.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá nhân viên"));
    } catch {
      // Global MutationCache.onError already shows the toast
    } finally {
      setPendingDelete(null);
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
          userName: values.userName,
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
          () => toast.error(t("Tải ảnh đại diện thất bại")),
        );
      } else if (avatarFile === null && editing?.avatarUrl) {
        staffApi.deleteAvatar(staffId).then(
          () => void queryClient.invalidateQueries({ queryKey: staffKeys.all }),
          () => toast.error(t("Xóa ảnh đại diện thất bại")),
        );
      }
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  const columns: ColumnsType<StaffDto> = [
    {
      key: "fullName",
      title: t("Tên"),
      width: 240,
      render: (_, record) => record.fullName || record.userName,
    },
    {
      key: "phoneNumber",
      title: t("Số điện thoại"),
      dataIndex: "phoneNumber",
      width: 180,
      render: (v) => v || "—",
    },
    {
      key: "email",
      title: "Email",
      dataIndex: "email",
      width: 280,
      render: (v) => v || "—",
    },
    {
      key: "roleNames",
      title: t("Phân quyền"),
      dataIndex: "roleNames",
      width: 200,
      render: (v: string[]) => (v?.length > 0 ? v.join(", ") : "—"),
    },
    {
      key: "address",
      title: t("Địa chỉ"),
      width: 350,
      render: (_, record) => record.address || "—",
    },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 110,
      align: "center",
      render: (_, record) => (
        <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
          <Tooltip title={t("Chỉnh sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => { e.stopPropagation(); openEdit(record); }}
            />
          </Tooltip>
          <Tooltip title={t("Xoá")}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => { e.stopPropagation(); setPendingDelete(record); }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="reception-page">
      <PageHeader title={t("Nhân sự")} />

      {/* ── Desktop: inline toolbar ── */}
      <div className="reception-card reception-card--toolbar desktop-only">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("Tìm theo tên, email, số điện thoại...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ flex: 1 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {t("Tạo")}
          </Button>
        </div>
      </div>

      <div className="reception-card reception-card--tabs desktop-only">
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

      {/* ── Mobile: filter drawer + full-width create ── */}
      <div className="mobile-only mobile-filter-block">
        <MobileFilterDrawer
          open={filterOpen}
          onOpen={() => { setDraftKeyword(keyword); setDraftStatus(statusFilter); setFilterOpen(true); }}
          onClose={() => setFilterOpen(false)}
          onClear={() => { setDraftKeyword(""); setDraftStatus("all"); }}
          onApply={() => { setKeyword(draftKeyword); setStatusFilter(draftStatus); }}
        >
          <div>
            <div className="mobile-filter-label">{t("Tìm kiếm")}</div>
            <Input
              prefix={<SearchOutlined />}
              placeholder={t("Tìm theo tên, email, số điện thoại...")}
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              allowClear
            />
          </div>
          <div>
            <div className="mobile-filter-label">{t("Trạng thái")}</div>
            <div className="mobile-filter-pills">
              {statusTabs().map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`reception-status-pill ${draftStatus === tab.key ? "reception-status-pill--active" : ""}`}
                  onClick={() => setDraftStatus(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </MobileFilterDrawer>

        <Button type="primary" icon={<PlusOutlined />} block onClick={openCreate}>
          {t("Tạo")}
        </Button>
      </div>

      <div className="page-card" style={{ padding: 0 }}>
        <DataTable<StaffDto>
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={isLoading}
          pagination={pagination.buildConfig(data?.totalCount)}
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

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("nhân viên")}
        name={pendingDelete?.fullName || pendingDelete?.userName || ""}
        pending={deleteStaff.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
