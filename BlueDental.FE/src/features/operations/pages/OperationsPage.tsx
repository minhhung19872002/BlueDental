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
import { OperationReportPanel } from "../components/OperationReportPanel";
import { operationsTotal } from "../operationsTotal";
import {
  DEFAULT_MIDDLE_TAB,
  DEFAULT_SUB_TAB,
  findDivision,
  middleTabParamOf,
  operationsDivisions,
  subTabParamOf,
} from "../operationsTabs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { PageTabBar } from "@/components/PageTabBar";
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
 * The reference keeps every division's sub-tab in its own query parameter and
 * lets them all accumulate, so leaving a division and coming back returns to
 * the sub-tab it was left on. That is reproduced here rather than a single
 * shared `subTab`, because it is what the reference's own links carry.
 *
 * Only Trang chủ, Quy trình and Công việc are the category+article screen; the
 * rest are reports, and say so.
 */
export function OperationsPage() {
  const { division: divisionParam } = useParams<{ division?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const division = findDivision(divisionParam);
  const subTabParam = subTabParamOf(division);
  const subTabKey = searchParams.get(subTabParam) ?? DEFAULT_SUB_TAB;
  const subTab = division.subTabs.find((s) => s.key === subTabKey) ?? division.subTabs[0];

  const middleParam = middleTabParamOf(division);
  const middleKey = division.middleTabs
    ? (searchParams.get(middleParam) ?? DEFAULT_MIDDLE_TAB)
    : null;
  const middleTab = division.middleTabs?.find((m) => m.key === middleKey) ?? null;

  // Truy cập is a screen of its own; the sub-tabs belong to Tổng quan.
  const onMiddleReport = middleTab !== null && middleTab.key !== DEFAULT_MIDDLE_TAB;
  const showsArticles = !onMiddleReport && subTab.kind === "articles";

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

  const categoriesQuery = useOperationCategories(division.key, subTab.key, {
    enabled: showsArticles,
  });
  const categories = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);

  const articlesQuery = useOperationArticles(
    division.key,
    subTab.key,
    {
      categoryId: selectedCategoryId ?? undefined,
      filter: debouncedKeyword.trim() || undefined,
      skipCount: pagination.skipCount,
      maxResultCount: pagination.maxResultCount,
    },
    { enabled: showsArticles },
  );
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

  // A category id belongs to one sub-screen, so a link carried over from
  // another one — or a category just deleted — has to be let go of rather than
  // queried.
  useEffect(() => {
    if (!showsArticles || categoriesQuery.isFetching) return;

    const awaited = awaitingCategoryRef.current;
    if (awaited) {
      if (selectedCategoryId !== awaited) return;
      if (!categories.some((c) => c.id === awaited)) return;
      awaitingCategoryRef.current = null;
    }

    if (selectedCategoryId && !categories.some((c) => c.id === selectedCategoryId)) {
      selectCategory(null);
    }
  }, [categories, categoriesQuery.isFetching, selectedCategoryId, selectCategory, showsArticles]);

  /**
   * The other divisions' sub-tab parameters travel with a division link, as
   * they do in the reference; the selected category does not, because it names
   * a row that only this sub-screen has.
   */
  const divisionHref = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("category");
    const query = params.toString();
    return query ? `/operations/${key}?${query}` : `/operations/${key}`;
  };

  const changeSubTab = (key: string) => {
    setSearchParams((params) => {
      params.set(subTabParam, key);
      // Categories belong to one sub-tab, so the selection cannot travel.
      params.delete("category");
      return params;
    });
    setKeyword("");
    pagination.resetToFirstPage();
  };

  const changeMiddleTab = (key: string) => {
    setSearchParams((params) => {
      params.set(middleParam, key);
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
        width: 220,
        render: (_, article) => (
          <span className="bd-cat-num">{formatDate(article.creationTime)}</span>
        ),
      },
      {
        key: "lastModificationTime",
        title: t("Ngày cập nhật"),
        width: 260,
        render: (_, article) => (
          <span className="bd-cat-num">
            {formatDateTime(article.lastModificationTime ?? article.creationTime)}
          </span>
        ),
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 110,
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
          to: divisionHref(item.key),
        }))}
      />

      {division.middleTabs ? (
        <div className="bd-ops-middletabs" role="tablist" aria-label={division.label}>
          {division.middleTabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={item.key === middleTab?.key}
              className={cn(
                "bd-ops-middletab",
                item.key === middleTab?.key && "bd-ops-middletab--active",
              )}
              onClick={() => changeMiddleTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {onMiddleReport ? (
        <div className="bd-min0h bd-flex1">
          <OperationReportPanel label={middleTab?.label ?? ""} />
        </div>
      ) : (
        <>
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

          {showsArticles ? (
            <div className="bd-min0h bd-flex1">
              <div className="bd-ops-shell">
                <aside className="bd-ops-aside">
                  <OperationCategoryPanel
                    label={t("Phân loại")}
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

                <main className="bd-ops-main">
                  <div className="bd-ops-toolbar">
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      // The reference offers this only once an article has a
                      // category to be filed under.
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
                        pagination={pagination.buildConfig(totalCount, operationsTotal)}
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
          ) : (
            <div className="bd-min0h bd-flex1">
              <OperationReportPanel label={subTab.label} />
            </div>
          )}
        </>
      )}

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
