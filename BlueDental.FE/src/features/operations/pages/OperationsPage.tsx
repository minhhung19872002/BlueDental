import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button, Input, Tooltip } from "antd";
import { toast } from "sonner";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useDeleteOperationArticle,
  useDeleteOperationCategory,
  useOperationArticles,
  useOperationCategories,
  type OperationArticleDto,
  type OperationCategoryDto,
} from "../api/operationApi";
import { OperationArticleModal } from "../components/OperationArticleModal";
import { OperationCategoryModal } from "../components/OperationCategoryModal";
import { OperationCategoryPanel } from "../components/OperationCategoryPanel";
import { DEFAULT_SUB_TAB, findDivision, operationsDivisions } from "../operationsTabs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { PageTabBar } from "@/components/PageTabBar";
import { countedTotal } from "@/features/taxonomy/countedTotal";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { formatDate, formatDateTime } from "@/utils/format";

const DEFAULT_PAGE_SIZE = 20;

type PendingDelete =
  | { kind: "category"; id: string; name: string }
  | { kind: "article"; id: string; name: string };

/**
 * Vận hành — one screen per division, each with its own sub-tabs.
 *
 * The reference makes every division its own route and carries the sub-tab in
 * the query string, so both are in the URL here too: a sub-screen can be
 * bookmarked, shared and reached with the back button.
 *
 * Below the tabs it is the same shape as Danh mục — categories on the left, the
 * articles of the selected one on the right — so it is built out of the same
 * pieces rather than a second set that merely looks alike.
 */
export function OperationsPage() {
  const { division: divisionParam } = useParams<{ division?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const division = findDivision(divisionParam);
  const subTabKey = searchParams.get("subTab") ?? DEFAULT_SUB_TAB;
  const subTab = division.subTabs.find((s) => s.key === subTabKey) ?? division.subTabs[0];

  const selectedCategoryId = searchParams.get("category");

  const pagination = useTablePagination(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState("");
  const [categoryModal, setCategoryModal] = useState<{
    open: boolean;
    category: OperationCategoryDto | null;
  }>({ open: false, category: null });
  const [articleModal, setArticleModal] = useState<{
    open: boolean;
    article: OperationArticleDto | null;
  }>({ open: false, article: null });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const debouncedKeyword = useDebounce(keyword, 300);

  const categoriesQuery = useOperationCategories(division.key, subTab.key);
  const categories = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);

  const articlesQuery = useOperationArticles(division.key, subTab.key, {
    categoryId: selectedCategoryId ?? undefined,
    filter: debouncedKeyword.trim() || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const articles = articlesQuery.data?.items ?? [];
  const totalCount = articlesQuery.data?.totalCount ?? 0;

  const deleteCategory = useDeleteOperationCategory();
  const deleteArticle = useDeleteOperationArticle();

  /** A category selected before the list holding it has been refetched. */
  const awaitingCategoryRef = useRef<string | null>(null);

  const selectCategory = useCallback(
    (id: string | null) => {
      setSearchParams((params) => {
        if (id) params.set("category", id);
        else params.delete("category");
        return params;
      });
      pagination.resetToFirstPage();
    },
    [setSearchParams, pagination],
  );

  // A category id belongs to one sub-screen, so a link carried over from another
  // one — or a category just deleted — has to be let go of rather than queried.
  useEffect(() => {
    if (categoriesQuery.isFetching) return;

    const awaited = awaitingCategoryRef.current;
    if (awaited) {
      if (selectedCategoryId !== awaited) return;
      if (!categories.some((c) => c.id === awaited)) return;
      awaitingCategoryRef.current = null;
    }

    if (selectedCategoryId && !categories.some((c) => c.id === selectedCategoryId)) {
      selectCategory(null);
    }
  }, [categories, categoriesQuery.isFetching, selectedCategoryId, selectCategory]);

  const changeSubTab = (key: string) => {
    setSearchParams((params) => {
      params.set("subTab", key);
      // Categories belong to one sub-tab, so the selection cannot travel.
      params.delete("category");
      return params;
    });
    pagination.resetToFirstPage();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      if (pendingDelete.kind === "category") {
        await deleteCategory.mutateAsync(pendingDelete.id);
        if (selectedCategoryId === pendingDelete.id) selectCategory(null);
        toast.success(t("Đã xoá mục"));
      } else {
        await deleteArticle.mutateAsync(pendingDelete.id);
        toast.success(t("Đã xoá bài viết"));
      }
    } catch {
      // queryClient reports the failure; nothing to add here.
    } finally {
      setPendingDelete(null);
    }
  };

  const columns = useMemo<ColumnsType<OperationArticleDto>>(
    () => [
      {
        key: "title",
        title: t("Tiêu đề"),
        render: (_, article) => <span className="bd-cat-medium">{article.title}</span>,
      },
      {
        key: "creationTime",
        title: t("Ngày tạo"),
        width: 200,
        render: (_, article) => (
          <span className="bd-cat-num">{formatDate(article.creationTime)}</span>
        ),
      },
      {
        key: "lastModificationTime",
        title: t("Ngày cập nhật"),
        width: 220,
        render: (_, article) => (
          <span className="bd-cat-num">
            {formatDateTime(article.lastModificationTime ?? article.creationTime)}
          </span>
        ),
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 100,
        align: "center",
        fixed: "right",
        render: (_, article) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Chỉnh sửa")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Chỉnh sửa {0}", article.title)}
                onClick={() => setArticleModal({ open: true, article })}
              />
            </Tooltip>
            <Tooltip title={t("Xoá")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Xoá {0}", article.title)}
                onClick={() =>
                  setPendingDelete({ kind: "article", id: article.id, name: article.title })
                }
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="bd-taxonomy-page">
      <PageTabBar
        label={t("Vận hành")}
        activeKey={division.key}
        tabs={operationsDivisions().map((item) => ({
          key: item.key,
          label: item.label,
          to: `/operations/${item.key}`,
        }))}
      />

      <div className="bd-ops-subtabs">
        <div className="pill-tabs" role="tablist" aria-label={division.label}>
          {division.subTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={item.key === subTab.key}
              className={cn("pill-tab", item.key === subTab.key && "pill-tab--active")}
              onClick={() => changeSubTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bd-min0h bd-flex1">
        <div className="bd-taxonomy-shell">
          <aside className="bd-taxonomy-aside">
            <OperationCategoryPanel
              title={t("Phân loại")}
              subtitle={t("Chọn mục để xem bài viết bên trong")}
              categories={categories}
              isLoading={categoriesQuery.isLoading}
              selectedId={selectedCategoryId}
              onSelect={(id) => selectCategory(id === selectedCategoryId ? null : id)}
              onCreate={() => setCategoryModal({ open: true, category: null })}
              onRename={(category) => setCategoryModal({ open: true, category })}
              onDelete={(category) =>
                setPendingDelete({ kind: "category", id: category.id, name: category.name })
              }
            />
          </aside>

          <main className="bd-taxonomy-main">
            <div className="bd-ops-toolbar">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                // The reference offers this only once an article has a category
                // to be filed under.
                disabled={!selectedCategoryId}
                title={selectedCategoryId ? undefined : t("Chọn một mục trước khi thêm")}
                onClick={() => setArticleModal({ open: true, article: null })}
              >
                {t("Tạo Bài Viết")}
              </Button>

              <Input
                className="bd-ops-search"
                prefix={<SearchOutlined />}
                placeholder={t("Tìm kiếm")}
                aria-label={t("Tìm kiếm")}
                value={keyword}
                allowClear
                onChange={(event) => {
                  setKeyword(event.target.value);
                  pagination.resetToFirstPage();
                }}
              />
            </div>

            <div className="bd-cat-body">
              <div className="bd-cat-card">
                <DataTable<OperationArticleDto>
                  columns={columns}
                  dataSource={articles}
                  rowKey="id"
                  loading={articlesQuery.isFetching}
                  pagination={pagination.buildConfig(totalCount, countedTotal(t("bài viết")))}
                  locale={{
                    emptyText: debouncedKeyword
                      ? t("Không tìm thấy kết quả phù hợp")
                      : t("Không có dữ liệu"),
                  }}
                />
              </div>
            </div>
          </main>
        </div>
      </div>

      <OperationCategoryModal
        open={categoryModal.open}
        category={categoryModal.category}
        department={division.key}
        subTab={subTab.key}
        onClose={() => setCategoryModal({ open: false, category: null })}
        onCreated={(created) => {
          awaitingCategoryRef.current = created.id;
          selectCategory(created.id);
        }}
      />

      <OperationArticleModal
        open={articleModal.open}
        article={articleModal.article}
        categoryId={selectedCategoryId}
        department={division.key}
        subTab={subTab.key}
        onClose={() => setArticleModal({ open: false, article: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={pendingDelete?.kind === "category" ? t("mục") : t("bài viết")}
        name={pendingDelete?.name ?? ""}
        pending={deleteCategory.isPending || deleteArticle.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
