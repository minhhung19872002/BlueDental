import { Button, Segmented, Tooltip } from "antd";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { CreditCardOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  PAYMENT_ACCOUNT_KIND,
  paymentAccountKindLabels,
  useDeletePaymentAccount,
  usePaymentAccounts,
  type PaymentAccountDto,
  type PaymentAccountKind,
} from "../api/paymentAccountApi";
import { FlatScreenHeader } from "./FlatScreenHeader";
import { countedTotal } from "../countedTotal";
import { PaymentAccountModal } from "./PaymentAccountModal";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useBranchFilter, useIsAllBranches } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";

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

  const pagination = useTablePagination(DEFAULT_PAGE_SIZE);
  const [tab, setTab] = useState<TabKey>("momo");
  const [modal, setModal] = useState<{ open: boolean; account: PaymentAccountDto | null }>({
    open: false,
    account: null,
  });
  const [pendingDelete, setPendingDelete] = useState<PaymentAccountDto | null>(null);

  const kind = TAB_KIND[tab];
  const isMoMo = kind === PAYMENT_ACCOUNT_KIND.MoMo;

  const accountsQuery = usePaymentAccounts(branchFilter, {
    kind,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const deleteAccount = useDeletePaymentAccount();

  const accounts = accountsQuery.data?.items ?? [];
  const totalCount = accountsQuery.data?.totalCount ?? 0;

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteAccount.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá phương thức thanh toán"));
    } catch {
      // queryClient reports the failure; nothing to add here.
    } finally {
      setPendingDelete(null);
    }
  };

  /** A MoMo wallet is a phone number; a bank account is a name and a number. */
  const columns = useMemo<ColumnsType<PaymentAccountDto>>(() => {
    const list: ColumnsType<PaymentAccountDto> = [
      isMoMo
        ? {
            key: "phoneNumber",
            title: t("Số điện thoại"),
            render: (_, account) => <span className="bd-num">{account.phoneNumber}</span>,
          }
        : { key: "bankName", title: t("Tên ngân hàng"), dataIndex: "bankName" },
      { key: "holderName", title: t("Tên chủ tài khoản"), dataIndex: "holderName" },
    ];

    if (!isMoMo) {
      list.push({
        key: "accountNumber",
        title: t("Số tài khoản"),
        render: (_, account) => <span className="bd-num">{account.accountNumber}</span>,
      });
    }

    list.push(
      {
        key: "lastModificationTime",
        title: t("Lần cập nhật cuối"),
        width: 200,
        render: (_, account) => (
          <span className="bd-cat-num">
            {formatDate(account.lastModificationTime ?? account.creationTime)}
          </span>
        ),
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 110,
        align: "center",
        fixed: "right",
        render: (_, account) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Chỉnh sửa")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Chỉnh sửa {0}", account.holderName)}
                onClick={() => setModal({ open: true, account })}
              />
            </Tooltip>
            <Tooltip title={t("Xoá")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Xoá {0}", account.holderName)}
                onClick={() => setPendingDelete(account)}
              />
            </Tooltip>
          </div>
        ),
      },
    );

    return list;
  }, [isMoMo]);

  return (
    <div className="bd-cat-screen">
      <FlatScreenHeader
        icon={<CreditCardOutlined />}
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
            pagination.resetToFirstPage();
          }}
          options={[
            { value: "momo", label: kindLabels[PAYMENT_ACCOUNT_KIND.MoMo] },
            { value: "bank", label: kindLabels[PAYMENT_ACCOUNT_KIND.Bank] },
          ]}
        />

        <div className="bd-cat-card">
          <DataTable<PaymentAccountDto>
            columns={columns}
            dataSource={accounts}
            rowKey="id"
            loading={accountsQuery.isFetching}
            pagination={pagination.buildConfig(totalCount, countedTotal(t("bản ghi")))}
            locale={{
              emptyText: isMoMo
                ? t("Không có phương thức MoMo")
                : t("Không có phương thức ngân hàng"),
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
