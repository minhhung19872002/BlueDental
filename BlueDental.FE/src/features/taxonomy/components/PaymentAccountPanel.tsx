import { useEffect, useState } from "react";
import { CreditCard, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  PAYMENT_ACCOUNT_KIND,
  paymentAccountKindLabels,
  useDeletePaymentAccount,
  usePaymentAccounts,
  type PaymentAccountDto,
  type PaymentAccountKind,
} from "../api/paymentAccountApi";
import { FlatScreenHeader } from "./FlatScreenHeader";
import { PaymentAccountModal } from "./PaymentAccountModal";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Spinner } from "@/components/Spinner";
import { TablePaginationBar } from "@/components/TablePaginationBar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { extractApiError } from "@/lib/apiError";
import { useBranchFilter, useIsAllBranches } from "@/lib/clinicBranch";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";

const HEAD_CELL =
  "sticky top-0 z-10 h-10 border-b border-app-line bg-app-surface px-4 py-2 text-left align-middle text-[14px] font-medium whitespace-nowrap text-app-label";
const BODY_CELL = "h-14 border-b border-app-line px-4 py-3 align-middle text-[14px] text-app-ink";
const STICKY_END = "sticky right-0 shadow-[-4px_0_6px_-2px_rgba(27,42,65,0.06)]";

const DEFAULT_PAGE_SIZE = 20;

/** The two tabs are two kinds of the same record, so the tab key is the kind. */
type TabKey = "momo" | "bank";

const TAB_KIND: Record<TabKey, PaymentAccountKind> = {
  momo: PAYMENT_ACCOUNT_KIND.MoMo,
  bank: PAYMENT_ACCOUNT_KIND.Bank,
};

/** Danh mục / Phương thức thanh toán — MoMo wallets and bank accounts. */
export function PaymentAccountPanel() {
  /** The list follows the header's branch; a record needs one concrete branch. */
  const branchFilter = useBranchFilter();
  const isAllBranches = useIsAllBranches();
  const kindLabels = paymentAccountKindLabels();

  const [tab, setTab] = useState<TabKey>("momo");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [modal, setModal] = useState<{ open: boolean; account: PaymentAccountDto | null }>({
    open: false,
    account: null,
  });
  const [pendingDelete, setPendingDelete] = useState<PaymentAccountDto | null>(null);

  const kind = TAB_KIND[tab];
  const isMoMo = kind === PAYMENT_ACCOUNT_KIND.MoMo;

  const accountsQuery = usePaymentAccounts(branchFilter, {
    kind,
    skipCount: (page - 1) * pageSize,
    maxResultCount: pageSize,
  });
  const deleteAccount = useDeletePaymentAccount();

  const accounts = accountsQuery.data?.items ?? [];
  const totalCount = accountsQuery.data?.totalCount ?? 0;
  const columnCount = isMoMo ? 4 : 5;

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [page, pageSize, totalCount]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteAccount.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá phương thức thanh toán"));
    } catch (cause) {
      toast.error(extractApiError(cause));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-app-surface">
      <FlatScreenHeader
        icon={CreditCard}
        title={t("Quản lý phương thức thanh toán")}
        subtitle={t("Tạo và quản lý tài khoản MoMo, ngân hàng dùng khi thanh toán.")}
        actionLabel={t("Thêm phương thức")}
        onAction={() => setModal({ open: true, account: null })}
        actionDisabled={isAllBranches}
        actionDisabledHint={t("Chọn một chi nhánh cụ thể trước khi thêm")}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-3 md:p-5">
        <SegmentedControl
          tone="app"
          className="w-full md:w-auto md:self-start"
          value={tab}
          onChange={(next) => {
            setTab(next);
            setPage(1);
          }}
          options={[
            { key: "momo", label: kindLabels[PAYMENT_ACCOUNT_KIND.MoMo] },
            { key: "bank", label: kindLabels[PAYMENT_ACCOUNT_KIND.Bank] },
          ]}
        />

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-app-line bg-white shadow-[0_2px_6px_rgba(27,42,65,0.06)]">
          <div className="relative min-h-0 w-full flex-1 overflow-auto">
            {accountsQuery.isFetching && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70">
                <Spinner />
              </div>
            )}

            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {isMoMo ? (
                    <th className={HEAD_CELL}>{t("Số điện thoại")}</th>
                  ) : (
                    <th className={HEAD_CELL}>{t("Tên ngân hàng")}</th>
                  )}
                  <th className={HEAD_CELL}>{t("Tên chủ tài khoản")}</th>
                  {!isMoMo && <th className={HEAD_CELL}>{t("Số tài khoản")}</th>}
                  <th className={HEAD_CELL}>{t("Lần cập nhật cuối")}</th>
                  <th className={cn(HEAD_CELL, "z-20 text-center", STICKY_END)}>{t("Thao tác")}</th>
                </tr>
              </thead>

              <tbody className="[&_tr:last-child_td]:border-b-0">
                {accounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columnCount}
                      className="h-32 border-app-line px-4 py-3 text-center align-middle text-[14px] text-app-label"
                    >
                      {isMoMo
                        ? t("Không có phương thức MoMo")
                        : t("Không có phương thức ngân hàng")}
                    </td>
                  </tr>
                ) : (
                  accounts.map((account) => (
                    <tr
                      key={account.id}
                      className="group bg-white transition-colors hover:bg-app-surface"
                    >
                      <td className={BODY_CELL}>
                        {isMoMo ? (
                          <span className="tabular-nums">{account.phoneNumber}</span>
                        ) : (
                          account.bankName
                        )}
                      </td>
                      <td className={BODY_CELL}>{account.holderName}</td>
                      {!isMoMo && (
                        <td className={BODY_CELL}>
                          <span className="tabular-nums">{account.accountNumber}</span>
                        </td>
                      )}
                      <td className={BODY_CELL}>
                        <span className="tabular-nums text-app-label">
                          {formatDate(account.lastModificationTime ?? account.creationTime)}
                        </span>
                      </td>

                      <td
                        className={cn(
                          BODY_CELL,
                          "z-10 bg-white text-center",
                          STICKY_END,
                          "group-hover:bg-app-surface",
                        )}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            aria-label={t("Chỉnh sửa {0}", account.holderName)}
                            onClick={() => setModal({ open: true, account })}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-app-label outline-none transition-colors duration-150 hover:bg-app-surface hover:text-app-ink focus-visible:ring-2 focus-visible:ring-app-primary/40"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("Xoá {0}", account.holderName)}
                            onClick={() => setPendingDelete(account)}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-app-danger outline-none transition-colors duration-150 hover:bg-app-danger/10 focus-visible:ring-2 focus-visible:ring-app-danger/40"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePaginationBar
            page={page}
            pageSize={pageSize}
            total={totalCount}
            unitLabel=""
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </div>
      </div>

      <PaymentAccountModal
        open={modal.open}
        kind={kind}
        account={modal.account}
        onClose={() => setModal({ open: false, account: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("phương thức thanh toán")}
        name={pendingDelete?.holderName ?? ""}
        pending={deleteAccount.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
