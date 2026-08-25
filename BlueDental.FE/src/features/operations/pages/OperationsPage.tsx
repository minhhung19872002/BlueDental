import { useState } from "react";
import { Table, Empty, Button, Input, Modal, Popconfirm } from "antd";
import { toast } from "sonner";
import { SearchOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { DivisionStatsGrid } from "../components/DivisionStatsGrid";
import {
  useOperationCategories, useCreateOperationCategory, useDeleteOperationCategory,
  useOperationArticles, useCreateOperationArticle, useUpdateOperationArticle, useDeleteOperationArticle,
  type OperationCategoryDto, type OperationArticleDto,
} from "../api/operationApi";

interface MainTabDef {
  key: string;
  labelKey: string;
  subTabs: { key: string; labelKey: string }[];
}

const MAIN_TAB_DEFS: MainTabDef[] = [
  {
    key: "overview",
    labelKey: "Quản trị vận hành",
    subTabs: [
      { key: "home",         labelKey: "Trang chủ" },
      { key: "process",      labelKey: "Quy trình" },
      { key: "task",         labelKey: "Công việc" },
      { key: "report",       labelKey: "Báo cáo" },
      { key: "untreated",    labelKey: "Chẩn đoán chưa điều trị" },
      { key: "prescription", labelKey: "Đơn thuốc" },
    ],
  },
  {
    key: "assistant",
    labelKey: "Khối trợ lý",
    subTabs: [
      { key: "home",    labelKey: "Trang chủ" },
      { key: "process", labelKey: "Quy trình" },
      { key: "task",    labelKey: "Công việc" },
    ],
  },
  {
    key: "reception",
    labelKey: "Khối lễ tân",
    subTabs: [
      { key: "home",    labelKey: "Trang chủ" },
      { key: "process", labelKey: "Quy trình" },
      { key: "task",    labelKey: "Công việc" },
      { key: "report",  labelKey: "Báo cáo" },
    ],
  },
  {
    key: "cskh",
    labelKey: "Khối CSKH",
    subTabs: [
      { key: "home",    labelKey: "Trang chủ" },
      { key: "process", labelKey: "Quy trình" },
      { key: "task",    labelKey: "Công việc" },
      { key: "report",  labelKey: "Báo cáo" },
    ],
  },
  {
    key: "marketing",
    labelKey: "Khối Marketing",
    subTabs: [
      { key: "home",    labelKey: "Trang chủ" },
      { key: "process", labelKey: "Quy trình" },
      { key: "task",    labelKey: "Công việc" },
      { key: "report",  labelKey: "Báo cáo" },
    ],
  },
  {
    key: "security",
    labelKey: "Khối bảo vệ",
    subTabs: [
      { key: "home",    labelKey: "Trang chủ" },
      { key: "process", labelKey: "Quy trình" },
      { key: "task",    labelKey: "Công việc" },
      { key: "report",  labelKey: "Báo cáo" },
    ],
  },
  {
    key: "treatment",
    labelKey: "Khối điều trị",
    subTabs: [
      { key: "home",    labelKey: "Trang chủ" },
      { key: "process", labelKey: "Quy trình" },
      { key: "task",    labelKey: "Công việc" },
      { key: "report",  labelKey: "Báo cáo" },
    ],
  },
  {
    key: "finance",
    labelKey: "Khối tài chính",
    subTabs: [
      { key: "home",    labelKey: "Trang chủ" },
      { key: "process", labelKey: "Quy trình" },
      { key: "task",    labelKey: "Công việc" },
      { key: "report",  labelKey: "Báo cáo" },
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

  const currentTabDef = MAIN_TAB_DEFS.find((t) => t.key === activeTab)!;
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
      { onSuccess: () => { setCategoryModalOpen(false); setCategoryName(""); toast.success(t("Đã tạo mục")); } },
    );
  };

  const handleCreateOrUpdateArticle = () => {
    if (!articleTitle.trim()) return;
    if (editingArticle) {
      updateArticle.mutate(
        { id: editingArticle.id, data: { title: articleTitle.trim() } },
        { onSuccess: () => { setArticleModalOpen(false); setArticleTitle(""); setEditingArticle(null); toast.success(t("Đã cập nhật")); } },
      );
    } else {
      const catId = selectedCategoryId ?? categories[0]?.id;
      if (!catId) { toast.warning(t("Vui lòng tạo mục trước")); return; }
      createArticle.mutate(
        { title: articleTitle.trim(), categoryId: catId, department: activeTab, subTab: activeSubTab },
        { onSuccess: () => { setArticleModalOpen(false); setArticleTitle(""); toast.success(t("Đã tạo bài viết")); } },
      );
    }
  };

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Quản trị vận hành")}
        subtitle={t("Chỉ số theo từng khối chức năng trong ngày")}
      />

      {/* The design switches the divisions with pills. */}
      <div className="pill-tabs" role="tablist" style={{ marginBottom: 4 }}>
        {MAIN_TAB_DEFS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === activeTab}
            className={`pill-tab${tab.key === activeTab ? " pill-tab--active" : ""}`}
            onClick={() => { setActiveTab(tab.key); setSelectedCategoryId(undefined); }}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* One card per division, as the design lays this screen out. The
          component was written for it and then never rendered. */}
      <DivisionStatsGrid />

      {currentTabDef.subTabs.length > 0 && (
        <div className="pill-tabs" role="tablist" style={{ marginBottom: 4 }}>
          {currentTabDef.subTabs.map((sub) => (
            <button
              key={sub.key}
              type="button"
              role="tab"
              aria-selected={sub.key === activeSubTab}
              className={`pill-tab${sub.key === activeSubTab ? " pill-tab--active" : ""}`}
              onClick={() => setSubTab(sub.key)}
            >
              {t(sub.labelKey)}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div className="reception-card" style={{ width: 220, minWidth: 180, flexShrink: 0, padding: 12 }}>
          <Button type="dashed" block icon={<PlusOutlined />} style={{ marginBottom: 10 }} onClick={() => setCategoryModalOpen(true)}>
            {t("Thêm Mới")}
          </Button>
          {categories.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
              {t("Chưa có mục nào")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {categories.map((cat: OperationCategoryDto) => (
                <div
                  key={cat.id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                    background: selectedCategoryId === cat.id ? "#EBF3FE" : "transparent",
                    color: selectedCategoryId === cat.id ? "var(--bd-blue)" : "#374151",
                    fontWeight: selectedCategoryId === cat.id ? 600 : 400, fontSize: 13,
                  }}
                  onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? undefined : cat.id)}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cat.name}</span>
                  <Popconfirm title={t("Xoá mục này?")} onConfirm={() => deleteCategory.mutateAsync(cat.id)}>
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
              <Button type="primary" style={{ background: "var(--bd-blue)" }} onClick={() => { setEditingArticle(null); setArticleTitle(""); setArticleModalOpen(true); }}>
                {t("Tạo Bài Viết")}
              </Button>
              <Input
                prefix={<SearchOutlined style={{ color: "#9CA3AF" }} />}
                placeholder={t("Tìm kiếm...")}
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
                { title: t("Tiêu đề"), dataIndex: "title", key: "title" },
                { title: t("Ngày tạo"), dataIndex: "creationTime", key: "creationTime", width: 130,
                  render: (v: string) => dayjs(v).format("DD/MM/YYYY") },
                { title: t("Ngày cập nhật"), dataIndex: "lastModificationTime", key: "lastModificationTime", width: 150,
                  render: (v: string) => v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "—" },
                {
                  title: t("Thao tác"), key: "actions", width: 120,
                  render: (_: unknown, record: OperationArticleDto) => (
                    <div style={{ display: "flex", gap: 6 }}>
                      <Button size="small" onClick={() => { setEditingArticle(record); setArticleTitle(record.title); setArticleModalOpen(true); }}>{t("Sửa")}</Button>
                      <Popconfirm title={t("Xoá bài viết?")} onConfirm={() => deleteArticle.mutateAsync(record.id)}>
                        <Button size="small" danger>{t("Xoá")}</Button>
                      </Popconfirm>
                    </div>
                  ),
                },
              ]}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("Không có dữ liệu")} /> }}
              pagination={{ pageSize: 20, showTotal: (total) => t("{0} bài viết", total) }}
            />
          </div>
        </div>
      </div>

      <Modal
        title={t("Thêm mục mới")}
        open={categoryModalOpen}
        onOk={handleCreateCategory}
        onCancel={() => { setCategoryModalOpen(false); setCategoryName(""); }}
        confirmLoading={createCategory.isPending}
      >
        <Input
          placeholder={t("Tên mục")}
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          onPressEnter={handleCreateCategory}
        />
      </Modal>

      <Modal
        title={editingArticle ? t("Sửa bài viết") : t("Tạo bài viết mới")}
        open={articleModalOpen}
        onOk={handleCreateOrUpdateArticle}
        onCancel={() => { setArticleModalOpen(false); setArticleTitle(""); setEditingArticle(null); }}
        confirmLoading={createArticle.isPending || updateArticle.isPending}
      >
        <Input
          placeholder={t("Tiêu đề bài viết")}
          value={articleTitle}
          onChange={(e) => setArticleTitle(e.target.value)}
          onPressEnter={handleCreateOrUpdateArticle}
        />
      </Modal>
    </div>
  );
}
