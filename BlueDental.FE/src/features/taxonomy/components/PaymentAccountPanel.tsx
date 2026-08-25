import { Segmented, Spin, message } from "antd";
import { useEffect, useState } from "react";
import { CreditCard, Pencil, Trash2 } from "lucide-react";
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
import { TablePaginationBar } from "@/components/TablePaginationBar";
import { extractApiError } from "@/lib/apiError";
import { useBranchFilter, useIsAllBranches } from "@/lib/clinicBranch";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";

const HEAD_CELL =
  "bd-cat-th";
const BODY_CELL = "bd-cat-td";
const STICKY_END = "bd-cat-sticky";

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
      message.success(t("Đã xoá phương thức thanh toán"));
    } catch (cause) {
      message.error(extractApiError(cause));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="bd-cat-screen">
      <FlatScreenHeader
        icon={CreditCard}
        title={t("Quản lý phương thức thanh toán")}
        subtitle={t("Tạo và quản lý tài khoản MoMo, ngân hàng dùng khi thanh toán.")}
        actionLabel={t("Thêm phương thức")}
        onAction={() => setModal({ open: true, account: null })}
        actionDisabled={isAllBranches}
        actionDisabledHint={t("Chọn một chi nhánh cụ thể trước khi thêm")}
      />

      <div className="bd-cat-body bd-cat-body--gap">
        <Segmented<TabKey>
          className="bd-catalog-segmented"
          value={tab}
          onChange={(next) => {
            setTab(next);
            setPage(1);
          }}
          options={[
            { value: "momo", label: kindLabels[PAYMENT_ACCOUNT_KIND.MoMo] },
            { value: "bank", label: kindLabels[PAYMENT_ACCOUNT_KIND.Bank] },
          ]}
        />

        <div className="bd-cat-card">
          <div className="bd-cat-scroll">
            {accountsQuery.isFetching && (
              <div className="bd-cat-busy">
                <Spin size="large" />
              </div>
            )}

            <table className="bd-cat-table bd-cat-table--wide">
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
                  <th className={cn(HEAD_CELL, "bd-z20 bd-text-center", STICKY_END)}>{t("Thao tác")}</th>
                </tr>
              </thead>

              <tbody className="bd-cat-tbody">
                {accounts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columnCount}
                      className="bd-cat-emptycell"
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
                      className="bd-cat-row"
                    >
                      <td className={BODY_CELL}>
                        {isMoMo ? (
                          <span className="bd-num">{account.phoneNumber}</span>
                        ) : (
                          account.bankName
                        )}
                      </td>
                      <td className={BODY_CELL}>{account.holderName}</td>
                      {!isMoMo && (
                        <td className={BODY_CELL}>
                          <span className="bd-num">{account.accountNumber}</span>
                        </td>
                      )}
                      <td className={BODY_CELL}>
                        <span className="bd-cat-num">
                          {formatDate(account.lastModificationTime ?? account.creationTime)}
                        </span>
                      </td>

                      <td
                        className={cn(
                          BODY_CELL,
                          "bd-cat-td--actions",
                          STICKY_END,
                        )}
                      >
                        <div className="bd-cat-rowactions">
                          <button
                            type="button"
                            aria-label={t("Chỉnh sửa {0}", account.holderName)}
                            onClick={() => setModal({ open: true, account })}
                            className="bd-cat-iconbtn"
                          >
                            <Pencil className="bd-icon bd-icon--sm" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("Xoá {0}", account.holderName)}
                            onClick={() => setPendingDelete(account)}
                            className="bd-cat-iconbtn bd-cat-iconbtn--danger"
                          >
                            <Trash2 className="bd-icon bd-icon--sm" aria-hidden="true" />
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
