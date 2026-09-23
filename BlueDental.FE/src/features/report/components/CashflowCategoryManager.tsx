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
  { key: "income", icon: <DollarOutlined />, title: () => t("Report:Category:Income") },
  { key: "expense", icon: <CreditCardOutlined />, title: () => t("Report:Category:Expense") },
];

const SALES_TYPE = { income: SALES_ENTRY_TYPE.Income, expense: SALES_ENTRY_TYPE.Expense } as const;

const CASHBOOK_CONFIG: CategoryPanelConfig = {
  title: () => t("Report:Category:Cashbook"),
  description: () => t("Report:Category:CashbookDesc"),
  searchPlaceholder: () => t("Report:Category:SearchPlaceholder"),
  emptyText: () => t("Report:Category:EmptyText"),
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
  const canUpdate = useReportPermission(
    isCashbook ? REPORT_PERMISSION.transferCategoryUpdate : REPORT_PERMISSION.cashflowCategoryUpdate,
  );
  const canDelete = useReportPermission(
    isCashbook ? REPORT_PERMISSION.transferCategoryDelete : REPORT_PERMISSION.cashflowCategoryDelete,
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
        toast.success(isCashbook ? t("Report:Category:DeletedCashbook") : t("Report:Category:DeletedGroup"));
        setDeleting(null);
      },
    });
  }, [deleting, deleteMutation, isCashbook]);

  const salesConfig: CategoryPanelConfig = {
    title: SALES_PANELS.find((p) => p.key === panel)?.title ?? (() => ""),
    description: () => t("Report:Category:UsageDesc"),
    searchPlaceholder: () => t("Report:Category:SearchLabel"),
    emptyText: () => t("Common:NoData"),
    showColor: false,
  };

  const content = (
    <CategoryPanel
      config={isCashbook ? CASHBOOK_CONFIG : salesConfig}
      categories={categories}
      loading={loading}
      canCreate={canCreate}
      onAdd={handleAdd}
      onEdit={canUpdate ? handleEdit : undefined}
      onDelete={canDelete ? setDeleting : undefined}
    />
  );

  return (
    <>
      {isCashbook ? (
        content
      ) : (
        <div className="report-category-layout">
          <aside className="reception-card reception-card--content report-category-sidebar">
            <div className="report-category-sidebar-title">{t("Report:Tab:Category")}</div>
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
        noun={t("Report:Noun:Category")}
        title={isCashbook ? undefined : t("Report:ConfirmDeleteVoucher")}
        name={deleting?.name ?? ""}
        pending={deleteMutation.isPending}
        onConfirm={handleDelete}
        onClose={closeDelete}
      />
    </>
  );
}
