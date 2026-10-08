import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useAbility } from "@/hooks/useAbility";
import { t } from "@/lib/i18n";
import { useCardDetail, useCards, useCardSummary, useCardTypes } from "../api/prepaidCardApi";
import { useCardActions } from "../hooks/useCardActions";
import { useCardListFilters } from "../hooks/useCardListFilters";
import type { CardDto } from "../types";
import { CardDetailDrawer } from "./CardDetailDrawer";
import { cardColumns } from "./cardColumns";
import { CardSummaryTiles } from "./CardSummaryTiles";
import { CardToolbar } from "./CardToolbar";
import { SellCardDialog } from "./SellCardDialog";
import { TopupDialog } from "./TopupDialog";

/** Tab "Thẻ đã phát hành" — Tình trạng thẻ (cụm 3 mục 2) and Bán thẻ. */
export function CardListPanel() {
  const ability = useAbility("prepaidCard");
  const staffId = useAuthStore((state) => state.user?.id);
  const filters = useCardListFilters();
  const { data: page, isLoading } = useCards(filters.query);
  const { data: summary } = useCardSummary();
  const { data: types = [] } = useCardTypes();
  const actions = useCardActions();
  const detail = useCardDetail(actions.openId);
  const filtered = Boolean(filters.query.filter || filters.state || filters.cardTypeId);
  const openSell = ability.canCreate ? actions.openSell : undefined;

  return (
    <>
      <CardSummaryTiles summary={summary} />
      <div className="page-card prepaid-panel">
        <CardToolbar
          keyword={filters.keyword}
          state={filters.state}
          cardTypeId={filters.cardTypeId}
          types={types}
          onKeywordChange={filters.setKeyword}
          onStateChange={filters.setState}
          onCardTypeChange={filters.setCardTypeId}
          onSell={openSell}
        />
        {!isLoading && page?.totalCount === 0 && !filtered ? (
          <EmptyState
            title={t("PrepaidCard:Empty")}
            description={t("PrepaidCard:EmptyHint")}
            actionLabel={openSell ? t("PrepaidCard:Sell:Title") : undefined}
            onAction={openSell}
          />
        ) : (
          <DataTable<CardDto>
            rowKey="id"
            loading={isLoading}
            dataSource={page?.items ?? []}
            columns={cardColumns(actions.open)}
            totalCount={page?.totalCount ?? 0}
            page={filters.page}
            pageSize={filters.pageSize}
            onPageChange={filters.setPage}
            scroll={{ x: 1400 }}
          />
        )}
      </div>

      <SellCardDialog
        open={actions.selling}
        saving={actions.savingSale}
        currentStaffId={staffId}
        onSubmit={(input) => void actions.sell(input)}
        onClose={actions.closeSell}
      />
      <TopupDialog
        card={actions.toppingUp}
        saving={actions.savingTopup}
        onSubmit={(input) => void actions.topup(input)}
        onClose={actions.closeTopup}
      />
      <CardDetailDrawer
        open={actions.openId !== null}
        card={detail.data}
        loading={detail.isLoading}
        onClose={actions.closeDetail}
        actions={{
          onTopup: ability.canUpdate ? actions.openTopup : undefined,
          onToggleLock: ability.canUpdate ? actions.toggleLock : undefined,
          onSaveMembers: ability.canUpdate ? actions.saveMembers : undefined,
          savingMembers: actions.savingMembers,
          togglingLock: actions.togglingLock,
        }}
      />
    </>
  );
}
