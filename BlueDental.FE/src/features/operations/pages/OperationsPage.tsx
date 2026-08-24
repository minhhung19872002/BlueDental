import { useState } from "react";
import { Search, Plus, Trash2, Pencil, Loader2 } from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const currentTabDef = MAIN_TAB_DEFS.find((td) => td.key === activeTab)!;
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

      <div className="reception-card px-4">
        <Tabs value={activeTab} onValueChange={(k) => { setActiveTab(k); setSelectedCategoryId(undefined); }}>
          <TabsList className="h-auto w-full justify-start gap-0 rounded-none border-b bg-transparent p-0">
            {MAIN_TAB_DEFS.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-[13px] data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {currentTabDef.subTabs.length > 0 && (
        <div className="reception-card reception-card--tabs">
          <div className="flex">
            {currentTabDef.subTabs.map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => setSubTab(sub.key)}
                className={`whitespace-nowrap border-b-2 bg-transparent px-4 py-2 text-[13px] ${
                  activeSubTab === sub.key
                    ? "border-primary font-semibold text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(sub.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Sidebar categories */}
        <div className="reception-card w-[220px] min-w-[180px] shrink-0 p-3">
          <Button variant="outline" className="mb-2.5 w-full border-dashed" onClick={() => setCategoryModalOpen(true)}>
            <Plus size={14} />
            {t("Thêm Mới")}
          </Button>
          {categories.length === 0 ? (
            <div className="pt-5 text-center text-[13px] text-muted-foreground">
              {t("Chưa có mục nào")}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {categories.map((cat: OperationCategoryDto) => (
                <div
                  key={cat.id}
                  className={`flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] ${
                    selectedCategoryId === cat.id
                      ? "bg-blue-50 font-semibold text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                  onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? undefined : cat.id)}
                >
                  <span className="truncate">{cat.name}</span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 shrink-0 text-destructive hover:text-destructive"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("Xoá mục này?")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("Hành động này không thể hoàn tác.")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCategory.mutate(cat.id)}>
                          {t("Xoá")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="reception-card reception-card--toolbar">
            <div className="flex items-center justify-between gap-2">
              <Button onClick={() => { setEditingArticle(null); setArticleTitle(""); setArticleModalOpen(true); }}>
                {t("Tạo Bài Viết")}
              </Button>
              <div className="relative max-w-[240px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("Tìm kiếm...")}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="reception-card reception-card--content">
            {articlesLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="animate-spin text-muted-foreground" />
              </div>
            ) : articles.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                {t("Không có dữ liệu")}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Tiêu đề")}</TableHead>
                    <TableHead className="w-[130px]">{t("Ngày tạo")}</TableHead>
                    <TableHead className="w-[150px]">{t("Ngày cập nhật")}</TableHead>
                    <TableHead className="w-[120px]">{t("Thao tác")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.title}</TableCell>
                      <TableCell>{dayjs(record.creationTime).format("DD/MM/YYYY")}</TableCell>
                      <TableCell>{record.lastModificationTime ? dayjs(record.lastModificationTime).format("DD/MM/YYYY HH:mm") : "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => { setEditingArticle(record); setArticleTitle(record.title); setArticleModalOpen(true); }}
                          >
                            <Pencil size={12} />
                            {t("Sửa")}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                                <Trash2 size={12} />
                                {t("Xoá")}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("Xoá bài viết?")}</AlertDialogTitle>
                                <AlertDialogDescription>{t("Hành động này không thể hoàn tác.")}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteArticle.mutate(record.id)}>
                                  {t("Xoá")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {articles.length > 0 && (
              <div className="border-t px-4 py-2 text-xs text-muted-foreground">
                {t("{0} bài viết", articles.length)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category modal */}
      <Dialog open={categoryModalOpen} onOpenChange={(open) => { if (!open) { setCategoryModalOpen(false); setCategoryName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Thêm mục mới")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("Tên mục")}
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCategoryModalOpen(false); setCategoryName(""); }}>
              {t("Hủy")}
            </Button>
            <Button onClick={handleCreateCategory} disabled={createCategory.isPending}>
              {createCategory.isPending && <Loader2 className="animate-spin" />}
              {t("Tạo")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Article modal */}
      <Dialog open={articleModalOpen} onOpenChange={(open) => { if (!open) { setArticleModalOpen(false); setArticleTitle(""); setEditingArticle(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingArticle ? t("Sửa bài viết") : t("Tạo bài viết mới")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("Tiêu đề bài viết")}
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateOrUpdateArticle(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setArticleModalOpen(false); setArticleTitle(""); setEditingArticle(null); }}>
              {t("Hủy")}
            </Button>
            <Button onClick={handleCreateOrUpdateArticle} disabled={createArticle.isPending || updateArticle.isPending}>
              {(createArticle.isPending || updateArticle.isPending) && <Loader2 className="animate-spin" />}
              {editingArticle ? t("Cập nhật") : t("Tạo")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
