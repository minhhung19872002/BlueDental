import { useState } from "react";
import { Table, Empty, Tabs, Button, Input, Modal, Popconfirm, message } from "antd";
import { SearchOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  useOperationCategories, useCreateOperationCategory, useDeleteOperationCategory,
  useOperationArticles, useCreateOperationArticle, useUpdateOperationArticle, useDeleteOperationArticle,
  type OperationCategoryDto, type OperationArticleDto,
} from "../api/operationApi";

const MAIN_TABS = [
  {
    key: "overview",
    label: "Quản trị vận hành",
    subTabs: [
      { key: "home",        label: "Trang chủ" },
      { key: "process",     label: "Quy trình" },
      { key: "task",        label: "Công việc" },
      { key: "report",      label: "Báo cáo" },
      { key: "untreated",   label: "Chẩn đoán chưa điều trị" },
      { key: "prescription",label: "Đơn thuốc" },
    ],
  },
  {
    key: "assistant",
    label: "Khối trợ lý",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
    ],
  },
  {
    key: "reception",
    label: "Khối lễ tân",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "cskh",
    label: "Khối CSKH",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "marketing",
    label: "Khối Marketing",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "security",
    label: "Khối bảo vệ",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "treatment",
    label: "Khối điều trị",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
  {
    key: "finance",
    label: "Khối tài chính",
    subTabs: [
      { key: "home",    label: "Trang chủ" },
      { key: "process", label: "Quy trình" },
      { key: "task",    label: "Công việc" },
      { key: "report",  label: "Báo cáo" },
    ],
  },
];

export function OperationsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [activeSubTabs, setActiveSubTabs] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [editingArticle, setEditingArticle] = useState<OperationArticleDto | null>(null);

  const currentTabDef = MAIN_TABS.find((t) => t.key === activeTab)!;
  const activeSubTab = activeSubTabs[activeTab] ?? currentTabDef.subTabs[0]?.key ?? "";

  const setSubTab = (sub: string) => {
    setActiveSubTabs((prev) => ({ ...prev, [activeTab]: sub }));
    setSelectedCategoryId(undefined);
  };

  const { data: categoriesData } = useOperationCategories(activeTab, activeSubTab);
  const categories = categoriesData?.items ?? [];

  const { data: articlesData, isLoading: articlesLoading } = useOperationArticles(
    activeTab, activeSubTab, selectedCategoryId, keyword || undefined,
  );
  const articles = articlesData?.items ?? [];

  const createCategory = useCreateOperationCategory();
  const deleteCategory = useDeleteOperationCategory();
  const createArticle = useCreateOperationArticle();
  const updateArticle = useUpdateOperationArticle();
  const deleteArticle = useDeleteOperationArticle();

  const handleCreateCategory = () => {
    if (!categoryName.trim()) return;
    createCategory.mutate(
      { name: categoryName.trim(), department: activeTab, subTab: activeSubTab },
      { onSuccess: () => { setCategoryModalOpen(false); setCategoryName(""); message.success("Đã tạo mục"); } },
    );
  };

  const handleCreateOrUpdateArticle = () => {
    if (!articleTitle.trim()) return;
    if (editingArticle) {
      updateArticle.mutate(
        { id: editingArticle.id, data: { title: articleTitle.trim() } },
        { onSuccess: () => { setArticleModalOpen(false); setArticleTitle(""); setEditingArticle(null); message.success("Đã cập nhật"); } },
      );
    } else {
      const catId = selectedCategoryId ?? categories[0]?.id;
      if (!catId) { message.warning("Vui lòng tạo mục trước"); return; }
      createArticle.mutate(
        { title: articleTitle.trim(), categoryId: catId, department: activeTab, subTab: activeSubTab },
        { onSuccess: () => { setArticleModalOpen(false); setArticleTitle(""); message.success("Đã tạo bài viết"); } },
      );
    }
  };

  return (
    <div className="reception-page">
      <div className="reception-card" style={{ padding: "0 16px" }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => { setActiveTab(k); setSelectedCategoryId(undefined); }}
          style={{ marginBottom: 0 }}
          items={MAIN_TABS.map((t) => ({ key: t.key, label: t.label }))}
        />
      </div>

      {currentTabDef.subTabs.length > 0 && (
        <div className="reception-card reception-card--tabs">
          <div style={{ display: "flex", gap: 0 }}>
            {currentTabDef.subTabs.map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => setSubTab(sub.key)}
                style={{
                  padding: "8px 16px", border: "none",
                  borderBottom: activeSubTab === sub.key ? "2px solid #1677ff" : "2px solid transparent",
                  background: "none",
                  color: activeSubTab === sub.key ? "#1677ff" : "#595959",
                  fontWeight: activeSubTab === sub.key ? 600 : 400,
                  cursor: "pointer", fontSize: 13, whiteSpace: "nowrap",
                }}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div className="reception-card" style={{ width: 220, minWidth: 180, flexShrink: 0, padding: 12 }}>
          <Button type="dashed" block icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setCategoryModalOpen(true)}>
            Thêm Mới
          </Button>
          {categories.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
              Chưa có mục nào
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                    background: selectedCategoryId === cat.id ? "#EBF3FE" : "transparent",
                    color: selectedCategoryId === cat.id ? "#1E70E6" : "#374151",
                    fontWeight: selectedCategoryId === cat.id ? 600 : 400, fontSize: 13,
                  }}
                  onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? undefined : cat.id)}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                  <Popconfirm title="Xoá mục này?" onConfirm={() => deleteCategory.mutate(cat.id)}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ flexShrink: 0 }} />
                  </Popconfirm>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 0 }}>
          <div className="reception-card reception-card--toolbar">
            <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
              <Button type="primary" style={{ background: "#2671D8" }} onClick={() => { setEditingArticle(null); setArticleTitle(""); setArticleModalOpen(true); }}>
                Tạo Bài Viết
              </Button>
              <Input
                prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
                placeholder="Tìm kiếm..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                allowClear
                style={{ maxWidth: 240 }}
              />
            </div>
          </div>
          <div className="reception-card reception-card--content">
            <Table<OperationArticleDto>
              rowKey="id"
              size="small"
              loading={articlesLoading}
              dataSource={articles}
              columns={[
                { title: "Tiêu đề", dataIndex: "title", key: "title" },
                { title: "Ngày tạo", dataIndex: "creationTime", key: "creationTime", width: 130,
                  render: (v: string) => dayjs(v).format("DD/MM/YYYY") },
                { title: "Ngày cập nhật", dataIndex: "lastModificationTime", key: "lastModificationTime", width: 150,
                  render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—" },
                {
                  title: "Thao tác", key: "actions", width: 120,
                  render: (_: unknown, record: OperationArticleDto) => (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button size="small" onClick={() => { setEditingArticle(record); setArticleTitle(record.title); setArticleModalOpen(true); }}>Sửa</Button>
                      <Popconfirm title="Xoá bài viết?" onConfirm={() => deleteArticle.mutate(record.id)}>
                        <Button size="small" danger>Xoá</Button>
                      </Popconfirm>
                    </div>
                  ),
                },
              ]}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu" /> }}
              pagination={{ pageSize: 20, showTotal: (total) => `${total} bài viết` }}
            />
          </div>
        </div>
      </div>

      <Modal
        title="Thêm mục mới"
        open={categoryModalOpen}
        onOk={handleCreateCategory}
        onCancel={() => { setCategoryModalOpen(false); setCategoryName(""); }}
        confirmLoading={createCategory.isPending}
      >
        <Input
          placeholder="Tên mục"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          onPressEnter={handleCreateCategory}
        />
      </Modal>

      <Modal
        title={editingArticle ? "Sửa bài viết" : "Tạo bài viết mới"}
        open={articleModalOpen}
        onOk={handleCreateOrUpdateArticle}
        onCancel={() => { setArticleModalOpen(false); setArticleTitle(""); setEditingArticle(null); }}
        confirmLoading={createArticle.isPending || updateArticle.isPending}
      >
        <Input
          placeholder="Tiêu đề bài viết"
          value={articleTitle}
          onChange={(e) => setArticleTitle(e.target.value)}
          onPressEnter={handleCreateOrUpdateArticle}
        />
      </Modal>
    </div>
  );
}
