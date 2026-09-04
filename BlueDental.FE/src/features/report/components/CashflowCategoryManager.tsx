import { useCallback, useState } from "react";
import { CreditCardOutlined, DollarOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { t } from "@/lib/i18n";
import { SALES_ENTRY_TYPE } from "../api/financeApi";
import { notifyDemoAction, useMockCashbookCategories, useMockCategories } from "../api/reportMockQueries";
import type { CategoryVm } from "../types/mock";
import { CategoryPanel, type CategoryPanelConfig } from "./CategoryPanel";
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
  showColor: true,
};

interface Props {
  /** "sales" = tab Quản lý thu chi (thu/chi sidebar); "cashbook" = tab Luân chuyển dòng tiền V2. */
  variant: "sales" | "cashbook";
}

export function CashflowCategoryManager({ variant }: Props) {
  const [panel, setPanel] = useState<SalesPanelKey>("income");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryVm | null>(null);
  const [deleting, setDeleting] = useState<CategoryVm | null>(null);

  const sales = useMockCategories();
  const cashbook = useMockCashbookCategories();
  const isCashbook = variant === "cashbook";
  const formVariant: CategoryVariant = isCashbook ? "cashbook" : panel;

  const categories = isCashbook
    ? (cashbook.data ?? [])
    : (sales.data ?? []).filter((c) => c.type === SALES_TYPE[panel]);
  const loading = isCashbook ? cashbook.isLoading : sales.isLoading;

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
  const handleDelete = useCallback(() => {
    if (deleting) notifyDemoAction(t("Xóa danh mục {0}", deleting.name));
    setDeleting(null);
  }, [deleting]);

  const salesConfig: CategoryPanelConfig = {
    title: SALES_PANELS.find((p) => p.key === panel)?.title ?? (() => ""),
    description: () => t("Dùng làm hình thức / mục khi tạo phiếu thu chi."),
    searchPlaceholder: () => t("Tìm kiếm danh mục"),
    showColor: false,
  };

  const content = (
    <CategoryPanel
      config={isCashbook ? CASHBOOK_CONFIG : salesConfig}
      categories={categories}
      loading={loading}
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
      <ConfirmDeleteDialog
        open={deleting !== null}
        noun={t("danh mục")}
        name={deleting?.name ?? ""}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </>
  );
}
