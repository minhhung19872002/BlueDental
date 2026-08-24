import { useState } from "react";
import {
  Button,
  Form,
  Input,
  Modal,
  Select,
  Empty,
  Spin,
  message,
} from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
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

type StatusFilter = "all" | "working" | "resigned";

const statusTabs = (): { key: StatusFilter; label: string }[] => [
  { key: "all", label: t("Tất cả") },
  { key: "working", label: t("Đang làm việc") },
  { key: "resigned", label: t("Đã nghỉ") },
];

interface StaffFormValues {
  userName: string;
  password?: string;
  name?: string;
  email: string;
  phoneNumber?: string;
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
  const [form] = Form.useForm<StaffFormValues>();
  const pagination = useTablePagination(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<StaffDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
      message.success(t("Đã xoá nhân viên"));
    } catch (error) {
      message.error(extractApiError(error));
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
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (staff: StaffDto) => {
    setEditing(staff);
    form.setFieldsValue({
      userName: staff.userName,
      name: staff.fullName || staff.name || "",
      email: staff.email ?? "",
      phoneNumber: staff.phoneNumber ?? "",
      roleNames: staff.roleNames,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    try {
      if (editing) {
        await updateStaff.mutateAsync({
          id: editing.id,
          data: {
            name: values.name,
            email: values.email,
            phoneNumber: values.phoneNumber,
            isActive: editing.isActive,
            roleNames: values.roleNames ?? [],
            branchIds: editing.branchIds,
          },
        });
        message.success(t("Đã cập nhật nhân viên"));
      } else {
        await createStaff.mutateAsync({
          userName: values.userName,
          password: values.password!,
          name: values.name,
          email: values.email,
          phoneNumber: values.phoneNumber,
          roleNames: values.roleNames ?? [],
          branchIds: [],
        });
        message.success(t("Đã tạo nhân viên"));
      }

      setModalOpen(false);
      form.resetFields();
    } catch (error) {
      message.error(extractApiError(error));
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
          <Input
            prefix={<SearchOutlined />}
            placeholder={t("Tìm theo tên, email, số điện thoại...")}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 320 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
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
        <div className="page-card">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <div className="page-card">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Chưa có nhân viên")} />
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

      <Modal
        open={modalOpen}
        title={editing ? t("Chỉnh sửa nhân viên") : t("Tạo nhân viên")}
        okText={editing ? t("Lưu") : t("Tạo")}
        cancelText={t("Huỷ")}
        confirmLoading={createStaff.isPending || updateStaff.isPending}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item
            name="userName"
            label={t("Tên đăng nhập")}
            rules={[{ required: true, message: t("Vui lòng nhập tên đăng nhập") }]}
          >
            <Input placeholder="letan01" disabled={Boolean(editing)} />
          </Form.Item>

          {!editing && (
            <Form.Item
              name="password"
              label={t("Mật khẩu")}
              rules={[{ required: true, message: t("Vui lòng nhập mật khẩu") }]}
              extra={t("Tối thiểu 8 ký tự, có chữ hoa, số và ký tự đặc biệt.")}
            >
              <Input.Password placeholder={t("Mật khẩu đăng nhập")} />
            </Form.Item>
          )}

          <Form.Item name="name" label={t("Họ và tên")}>
            <Input placeholder={"Nguyễn Văn An"} />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: t("Vui lòng nhập email") },
              { type: "email", message: t("Email không hợp lệ") },
            ]}
          >
            <Input placeholder="letan01@bluedental.vn" />
          </Form.Item>

          <Form.Item name="phoneNumber" label={t("Số điện thoại")}>
            <Input placeholder="09xxxxxxxx" />
          </Form.Item>

          <Form.Item name="roleNames" label={t("Vai trò")}>
            <Select
              mode="multiple"
              placeholder={t("Chọn vai trò")}
              options={(roleNames ?? []).map((role) => ({ value: role, label: role }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
