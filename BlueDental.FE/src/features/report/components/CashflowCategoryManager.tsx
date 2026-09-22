import { useCallback, useMemo, useState } from "react";
import { CreditCardOutlined, DollarOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import {
  SALES_ENTRY_TYPE,
  useCashflowCategories,
  useDeleteCashflowCategory,
  type CashflowCategoryDto,
} from "../api/financeApi";
import { REPORT_PERMISSION, useReportPermission } from "../hooks/useReportPermissions";
import { CategoryPanel, type CategoryPanelConfig, type CategoryVm } from "./CategoryPanel";
import { CategoryFormModal, type CategoryVariant } from "./CategoryFormModal";

type SalesPanelKey = "income" | "expense";

const SALES_PANELS: { key: SalesPanelKey; icon: React.ReactNode; title: () => string }[] = [
  { key: "income", icon: <DollarOutlined />, title: () => t("Danh mục thu nhập") },
  { key: "expense", icon: <CreditCardOutlined />, title: () => t("Danh mục chi phí") },
];

const SALES_TYPE = { income: SALES_ENTRY_TYPE.Income, expense: SALES_ENTRY_TYPE.Expense } as const;

const CASHBOOK_CONFIG: CategoryPanelConfig = {
  title: () => t("Danh mục sổ quỹ"),
  description: () => t("Quản lý danh mục con thuộc sổ quỹ."),
  searchPlaceholder: () => t("Tìm theo tên hoặc mã màu..."),
  emptyText: () => t("Không có danh mục nào"),
  showColor: true,
};

interface Props {
  variant: "sales" | "cashbook";
}

function toVm(dto: CashflowCategoryDto): CategoryVm {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    priority: dto.sortOrder,
    description: dto.description,
    colorCode: dto.colorCode ?? null,
  };
}

export function CashflowCategoryManager({ variant }: Props) {
  const [panel, setPanel] = useState<SalesPanelKey>("income");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryVm | null>(null);
  const [deleting, setDeleting] = useState<CategoryVm | null>(null);

  const branchId = useCurrentBranchId();
  const isCashbook = variant === "cashbook";
  const formVariant: CategoryVariant = isCashbook ? "cashbook" : panel;
  const canCreate = useReportPermission(
    isCashbook ? REPORT_PERMISSION.transferCategoryCreate : REPORT_PERMISSION.cashflowCategoryCreate,
  );

  const { data: salesResult, isLoading: salesLoading } = useCashflowCategories(branchId, false);
  const { data: cashbookResult, isLoading: cashbookLoading } = useCashflowCategories(branchId, true);

  const salesCategories = useMemo(() => (salesResult?.items ?? []).map(toVm), [salesResult]);
  const cashbookCategories = useMemo(() => (cashbookResult?.items ?? []).map(toVm), [cashbookResult]);

  const categories = isCashbook
    ? cashbookCategories
    : salesCategories.filter((c) => c.type === SALES_TYPE[panel]);
  const loading = isCashbook ? cashbookLoading : salesLoading;

  const handleAdd = useCallback(() => {
    setEditing(null);
    setFormOpen(true);
  }, []);
  const handleEdit = useCallback((category: CategoryVm) => {
    setEditing(category);
    setFormOpen(true);
  }, []);
  const closeForm = useCallback(() => setFormOpen(false), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  const deleteMutation = useDeleteCashflowCategory();
  const handleDelete = useCallback(() => {
    if (!deleting) return;
    deleteMutation.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(isCashbook ? t("Đã xoá danh mục") : t("Đã xoá nhóm"));
        setDeleting(null);
      },
    });
  }, [deleting, deleteMutation, isCashbook]);

  const salesConfig: CategoryPanelConfig = {
    title: SALES_PANELS.find((p) => p.key === panel)?.title ?? (() => ""),
    description: () => t("Dùng làm hình thức / mục khi tạo phiếu thu chi."),
    searchPlaceholder: () => t("Tìm kiếm danh mục"),
    emptyText: () => t("Không có dữ liệu"),
    showColor: false,
  };

  const content = (
    <CategoryPanel
      config={isCashbook ? CASHBOOK_CONFIG : salesConfig}
      categories={categories}
      loading={loading}
      canCreate={canCreate}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={setDeleting}
    />
  );

  return (
    <>
      {isCashbook ? (
        content
      ) : (
        <div className="report-category-layout">
          <aside className="reception-card reception-card--content report-category-sidebar">
            <div className="report-category-sidebar-title">{t("Danh mục")}</div>
            {SALES_PANELS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={["report-category-sidebar-item", p.key === panel && "report-category-sidebar-item--active"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setPanel(p.key)}
              >
                <span className="report-category-sidebar-icon">{p.icon}</span>
                {p.title()}
              </button>
            ))}
          </aside>
          {content}
        </div>
      )}

      <CategoryFormModal open={formOpen} variant={formVariant} category={editing} onClose={closeForm} />
      {/* Staging titles the sales-category dialog "Xác nhận xoá"; the cashbook one "Xác nhận xoá danh mục". */}
      <ConfirmDeleteDialog
        open={deleting !== null}
        noun={t("danh mục")}
        title={isCashbook ? undefined : t("Xác nhận xoá")}
        name={deleting?.name ?? ""}
        pending={deleteMutation.isPending}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </>
  );
}
