import { useState } from "react";
import { Table, Empty, Tabs, Button, Input, Modal, Popconfirm, Tag, DatePicker, message } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  DEPARTMENT_BY_TAB,
  OPERATIONS_SECTION,
  TASK_STATUS,
  taskStatusConfig,
  useCompleteTask,
  useCreateArticle,
  useCreateTask,
  useDeleteArticle,
  useDeleteTask,
  useOperationsArticles,
  useOperationsTaskStats,
  useOperationsTasks,
  usePublishArticle,
  useStartTask,
  useUnpublishArticle,
  type OperationsArticleDto,
  type OperationsDepartment,
  type OperationsSection,
  type OperationsTaskDto,
  type OperationsTaskStatus,
} from "../api/operationsApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDate } from "@/utils/format";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";

/**
 * Built on demand rather than frozen into a module constant: the labels go
 * through t(), and a module constant would capture the language that happened
 * to be loaded when this file was first imported.
 */
const mainTabs = () => [
  {
    key: "overview",
    label: t("Quản trị vận hành"),
    subTabs: [
      { key: "home",        label: t("Trang chủ") },
      { key: "process",     label: t("Quy trình") },
      { key: "task",        label: t("Công việc") },
      { key: "report",      label: t("Báo cáo") },
      { key: "untreated",   label: t("Chẩn đoán chưa điều trị") },
      { key: "prescription",label: t("Đơn thuốc") },
    ],
  },
  {
    key: "assistant",
    label: t("Khối trợ lý"),
    subTabs: [
      { key: "home",    label: t("Trang chủ") },
      { key: "process", label: t("Quy trình") },
      { key: "task",    label: t("Công việc") },
    ],
  },
  {
    key: "reception",
    label: t("Khối lễ tân"),
    subTabs: [
      { key: "home",    label: t("Trang chủ") },
      { key: "process", label: t("Quy trình") },
      { key: "task",    label: t("Công việc") },
      { key: "report",  label: t("Báo cáo") },
    ],
  },
  {
    key: "cskh",
    label: t("Khối CSKH"),
    subTabs: [
      { key: "home",    label: t("Trang chủ") },
      { key: "process", label: t("Quy trình") },
      { key: "task",    label: t("Công việc") },
      { key: "report",  label: t("Báo cáo") },
    ],
  },
  {
    key: "marketing",
    label: t("Khối Marketing"),
    subTabs: [
      { key: "home",    label: t("Trang chủ") },
      { key: "process", label: t("Quy trình") },
      { key: "task",    label: t("Công việc") },
      { key: "report",  label: t("Báo cáo") },
    ],
  },
  {
    key: "security",
    label: t("Khối bảo vệ"),
    subTabs: [
      { key: "home",    label: t("Trang chủ") },
      { key: "process", label: t("Quy trình") },
      { key: "task",    label: t("Công việc") },
      { key: "report",  label: t("Báo cáo") },
    ],
  },
  {
    key: "treatment",
    label: t("Khối điều trị"),
    subTabs: [
      { key: "home",    label: t("Trang chủ") },
      { key: "process", label: t("Quy trình") },
      { key: "task",    label: t("Công việc") },
      { key: "report",  label: t("Báo cáo") },
    ],
  },
  {
    key: "finance",
    label: t("Khối tài chính"),
    subTabs: [
      { key: "home",    label: t("Trang chủ") },
      { key: "process", label: t("Quy trình") },
      { key: "task",    label: t("Công việc") },
      { key: "report",  label: t("Báo cáo") },
    ],
  },
];

/**
 * Sections that hold content. The reference's read-only sections (Báo cáo, Truy
 * cập, Hóa đơn...) are views over other modules, so they are not backed here.
 */
const CONTENT_SECTIONS: Record<string, OperationsSection> = {
  home: OPERATIONS_SECTION.Home,
  process: OPERATIONS_SECTION.Process,
};

function ArticleSection({
  department,
  section,
  keyword,
}: {
  department: OperationsDepartment;
  section: OperationsSection;
  keyword: string;
}) {
  const branchId = useCurrentBranchId();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const params = {
    clinicBranchId: branchId,
    department,
    section,
    filter: keyword.trim() || undefined,
    maxResultCount: 100,
  };
  const { data, isLoading } = useOperationsArticles(params);

  const createArticle = useCreateArticle();
  const publishArticle = usePublishArticle();
  const unpublishArticle = useUnpublishArticle();
  const deleteArticle = useDeleteArticle();

  const run = async (action: Promise<unknown>, successMessage: string) => {
    try {
      await action;
      message.success(successMessage);
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return;

    try {
      await createArticle.mutateAsync({
        clinicBranchId: branchId,
        department,
        section,
        title: title.trim(),
        content: content.trim() || undefined,
      });
      setCreating(false);
      setTitle("");
      setContent("");
      message.success(t("Đã tạo bài viết"));
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const columns: ColumnsType<OperationsArticleDto> = [
    {
      title: t("Tiêu đề"),
      key: "title",
      render: (_, row) => (
        <>
          <div style={{ fontWeight: 600, color: "#101c2c" }}>
            {row.isPinned && <Tag color="gold">Ghim</Tag>}
            {row.title}
          </div>
          {row.summary && <div style={{ fontSize: 12, color: "#6f7c90" }}>{row.summary}</div>}
        </>
      ),
    },
    {
      title: t("Người tạo"),
      dataIndex: "authorName",
      key: "authorName",
      width: 160,
      render: (value: string | null) => value ?? "—",
    },
    {
      title: t("Ngày tạo"),
      dataIndex: "creationTime",
      key: "creationTime",
      width: 130,
      render: (value: string) => formatDate(value),
    },
    {
      title: t("Trạng thái"),
      dataIndex: "isPublished",
      key: "isPublished",
      width: 120,
      render: (isPublished: boolean) =>
        isPublished ? <Tag color="green">{t("Đã đăng")}</Tag> : <Tag>{t("Nháp")}</Tag>,
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 200,
      render: (_, row) => (
        <>
          {row.isPublished ? (
            <Button
              type="link"
              size="small"
              onClick={() => run(unpublishArticle.mutateAsync(row.id), t("Đã gỡ bài viết"))}
            >
              {t("Gỡ đăng")}
            </Button>
          ) : (
            <Button
              type="link"
              size="small"
              onClick={() => run(publishArticle.mutateAsync(row.id), t("Đã đăng bài viết"))}
            >
              {t("Đăng")}
            </Button>
          )}
          <Popconfirm
            title={t("Xoá bài viết này?")}
            okText={t("Xoá")}
            cancelText={t("Huỷ")}
            onConfirm={() => run(deleteArticle.mutateAsync(row.id), t("Đã xoá bài viết"))}
          >
            <Button type="link" size="small" danger>{t("Xoá")}</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <Button type="primary" onClick={() => setCreating(true)} style={{ background: "#1c3566" }}>
          {t("Tạo Bài Viết")}
        </Button>
      </div>

      <div className="reception-card reception-card--content">
        <Table<OperationsArticleDto>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={columns}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không có dữ liệu")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("{0} bài viết", total) }}
        />
      </div>

      <Modal
        open={creating}
        title={t("Tạo bài viết")}
        okText={t("Tạo")}
        cancelText={t("Huỷ")}
        confirmLoading={createArticle.isPending}
        onOk={handleCreate}
        onCancel={() => setCreating(false)}
      >
        <Input
          placeholder={t("Tiêu đề")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          rows={5}
          placeholder={t("Nội dung — cần có nội dung mới đăng được")}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </Modal>
    </>
  );
}

function TaskSection({
  department,
  keyword,
}: {
  department: OperationsDepartment;
  keyword: string;
}) {
  const branchId = useCurrentBranchId();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<dayjs.Dayjs | null>(null);

  const params = {
    clinicBranchId: branchId,
    department,
    filter: keyword.trim() || undefined,
    maxResultCount: 100,
  };
  const { data, isLoading } = useOperationsTasks(params);
  const { data: stats } = useOperationsTaskStats({ clinicBranchId: branchId, department });

  const createTask = useCreateTask();
  const startTask = useStartTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  const run = async (action: Promise<unknown>, successMessage: string) => {
    try {
      await action;
      message.success(successMessage);
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) return;

    try {
      await createTask.mutateAsync({
        clinicBranchId: branchId,
        department,
        title: title.trim(),
        dueDate: dueDate?.format("YYYY-MM-DD"),
      });
      setCreating(false);
      setTitle("");
      setDueDate(null);
      message.success(t("Đã tạo công việc"));
    } catch (error) {
      message.error(extractApiError(error));
    }
  };

  const columns: ColumnsType<OperationsTaskDto> = [
    { title: t("Công việc"), dataIndex: "title", key: "title" },
    {
      title: t("Người phụ trách"),
      dataIndex: "assigneeName",
      key: "assigneeName",
      width: 160,
      render: (value: string | null) => value ?? t("Chưa giao"),
    },
    {
      title: t("Hạn"),
      dataIndex: "dueDate",
      key: "dueDate",
      width: 140,
      render: (value: string | null, row) =>
        value ? (
          <span style={{ color: row.isOverdue ? "#ef4d4d" : undefined }}>
            {formatDate(value)}
            {row.isOverdue && t(" (quá hạn)")}
          </span>
        ) : (
          "—"
        ),
    },
    {
      title: t("Trạng thái"),
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: OperationsTaskStatus) => (
        <Tag color={taskStatusConfig()[status].color}>{taskStatusConfig()[status].label}</Tag>
      ),
    },
    {
      title: t("Thao tác"),
      key: "actions",
      width: 220,
      render: (_, row) => (
        <>
          {row.status === TASK_STATUS.Todo && (
            <Button
              type="link"
              size="small"
              onClick={() => run(startTask.mutateAsync(row.id), t("Đã bắt đầu công việc"))}
            >
              {t("Bắt đầu")}
            </Button>
          )}
          {(row.status === TASK_STATUS.Todo || row.status === TASK_STATUS.InProgress) && (
            <Button
              type="link"
              size="small"
              onClick={() => run(completeTask.mutateAsync(row.id), t("Đã hoàn thành công việc"))}
            >
              {t("Hoàn thành")}
            </Button>
          )}
          <Popconfirm
            title={t("Xoá công việc này?")}
            okText={t("Xoá")}
            cancelText={t("Huỷ")}
            onConfirm={() => run(deleteTask.mutateAsync(row.id), t("Đã xoá công việc"))}
          >
            <Button type="link" size="small" danger>{t("Xoá")}</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <>
      <div className="reception-card" style={{ padding: "12px 16px", display: "flex", gap: 24 }}>
        {/* Test ids because these labels also appear as row action buttons. */}
        {[
          { label: t("Tổng"), value: stats?.total ?? 0, testId: "ops-stat-total" },
          { label: t("Chưa làm"), value: stats?.todo ?? 0, testId: "ops-stat-todo" },
          { label: t("Đang làm"), value: stats?.inProgress ?? 0, testId: "ops-stat-in-progress" },
          { label: t("Hoàn thành"), value: stats?.done ?? 0, testId: "ops-stat-done" },
          { label: t("Quá hạn"), value: stats?.overdue ?? 0, testId: "ops-stat-overdue" },
        ].map((tile) => (
          <div key={tile.label} data-testid={tile.testId}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#101c2c" }}>{tile.value}</div>
            <div style={{ fontSize: 12, color: "#6f7c90" }}>{tile.label}</div>
          </div>
        ))}
      </div>

      <div className="reception-card reception-card--toolbar">
        <Button type="primary" onClick={() => setCreating(true)} style={{ background: "#1c3566" }}>
          {t("Tạo Công Việc")}
        </Button>
      </div>

      <div className="reception-card reception-card--content">
        <Table<OperationsTaskDto>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data?.items ?? []}
          columns={columns}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không có dữ liệu")} /> }}
          pagination={{ pageSize: 20, showTotal: (total) => t("{0} công việc", total) }}
        />
      </div>

      <Modal
        open={creating}
        title={t("Tạo công việc")}
        okText={t("Tạo")}
        cancelText={t("Huỷ")}
        confirmLoading={createTask.isPending}
        onOk={handleCreate}
        onCancel={() => setCreating(false)}
      >
        <Input
          placeholder={t("Tên công việc")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <DatePicker
          style={{ width: "100%" }}
          format="DD/MM/YYYY"
          placeholder={t("Hạn hoàn thành")}
          value={dueDate}
          onChange={setDueDate}
        />
      </Modal>
    </>
  );
}

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");

  const tabs = mainTabs();
  const currentTabDef = tabs.find((tab) => tab.key === activeTab)!;
  const activeSubTab = activeSubTabs[activeTab] ?? currentTabDef.subTabs[0]?.key ?? "";
  const department = DEPARTMENT_BY_TAB[activeTab];

  const setSubTab = (sub: string) => {
    setActiveSubTabs((prev) => ({ ...prev, [activeTab]: sub }));
  };

  const renderSection = () => {
    const section = CONTENT_SECTIONS[activeSubTab];

    if (section) {
      return <ArticleSection department={department} section={section} keyword={keyword} />;
    }

    if (activeSubTab === "task") {
      return <TaskSection department={department} keyword={keyword} />;
    }

    // Báo cáo / Truy cập / Chẩn đoán / Đơn thuốc / Hóa đơn are read-only views over
    // other modules on the reference; BlueDental has not built them yet.
    return (
      <div className="reception-card reception-card--content">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("Mục này là báo cáo tổng hợp từ các module khác — chưa dựng ở BlueDental.")}
        />
      </div>
    );
  };

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Quản trị vận hành")}
        subtitle={t("Chỉ số theo từng khối chức năng trong ngày")}
      />

      {/* Main department tabs */}
      <div className="reception-card" style={{ padding: "0 16px" }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k)}
          style={{ marginBottom: 0 }}
          items={tabs.map((tab) => ({ key: tab.key, label: tab.label }))}
        />
      </div>

      {/* Sub-tabs */}
      {currentTabDef.subTabs.length > 0 && (
        <div className="reception-card reception-card--tabs">
          <div style={{ display: "flex", gap: 0 }}>
            {currentTabDef.subTabs.map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => setSubTab(sub.key)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderBottom: activeSubTab === sub.key ? "2px solid #1c3566" : "2px solid transparent",
                  background: "none",
                  color: activeSubTab === sub.key ? "#1c3566" : "#6f7c90",
                  fontWeight: activeSubTab === sub.key ? 600 : 400,
                  cursor: "pointer",
                  fontSize: 13,
                  whiteSpace: "nowrap",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="reception-card reception-card--toolbar">
        <Input
          prefix={<SearchOutlined style={{ color: "#98a4b4" }} />}
          placeholder={t("Tìm kiếm...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          allowClear
          style={{ maxWidth: 240 }}
        />
      </div>

      {renderSection()}
    </div>
  );
}
