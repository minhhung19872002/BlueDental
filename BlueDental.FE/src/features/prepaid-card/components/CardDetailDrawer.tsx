import type { ReactNode } from "react";
import { Button, Descriptions, Drawer, Spin, Table } from "antd";
import { LockOutlined, PlusCircleOutlined, UnlockOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDateTime, formatVND } from "@/utils/format";
import { CARD_STATUS, type CardDetailDto } from "../types";
import { usesText } from "./cardColumns";
import { CardMembersEditor } from "./CardMembersEditor";
import { CardStateTag } from "./CardStateTag";
import { ledgerColumns } from "./ledgerColumns";
import { scopeSummary } from "./ServiceScopeFields";

export interface CardDetailActions {
  onTopup?: (card: CardDetailDto) => void;
  onToggleLock?: (card: CardDetailDto) => void;
  onSaveMembers?: (card: CardDetailDto, memberPatientIds: string[]) => void;
  savingMembers: boolean;
  togglingLock: boolean;
}

interface Props {
  open: boolean;
  card: CardDetailDto | undefined;
  loading: boolean;
  actions: CardDetailActions;
  onClose: () => void;
}

/** One card: its terms, who may spend it, and every movement of its balance. */
export function CardDetailDrawer({ open, card, loading, actions, onClose }: Props) {
  const locked = card?.status === CARD_STATUS.Locked;
  const extra: ReactNode = card ? (
    <span className="prepaid-drawer-actions">
      {actions.onToggleLock ? (
        <Button
          icon={locked ? <UnlockOutlined /> : <LockOutlined />}
          loading={actions.togglingLock}
          disabled={actions.togglingLock}
          danger={!locked}
          onClick={() => actions.onToggleLock?.(card)}
        >
          {t(locked ? "PrepaidCard:Unlock" : "PrepaidCard:Lock")}
        </Button>
      ) : null}
      {actions.onTopup && !locked ? (
        <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => actions.onTopup?.(card)}>
          {t("PrepaidCard:Topup:Action")}
        </Button>
      ) : null}
    </span>
  ) : null;

  return (
    <Drawer
      open={open}
      width="min(920px, 100vw)"
      title={card ? `${card.code} · ${card.name}` : t("PrepaidCard:Detail:Title")}
      extra={extra}
      onClose={onClose}
      destroyOnHidden
    >
      {loading || !card ? (
        <Spin />
      ) : (
        <div className="prepaid-detail">
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label={t("Common:Status")}>
              <CardStateTag card={card} />
            </Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Field:Owner")}>
              {card.ownerName ?? "—"} {card.ownerCode ? `· ${card.ownerCode}` : ""}
            </Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Col:Balance")}>
              <b>{formatVND(card.balance)}</b>
            </Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Detail:TotalLoaded")}>{formatVND(card.totalLoaded)}</Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Col:Uses")}>
              {usesText(card)} {card.maxUses ? "" : `(${t("PrepaidCard:Unlimited")})`}
            </Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Field:Scope")}>{scopeSummary(card)}</Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Field:SalePrice")}>{formatVND(card.salePrice)}</Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Field:UsageValue")}>{formatVND(card.usageValue)}</Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Field:Seller")}>{card.sellerName ?? "—"}</Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Detail:Commission")}>{formatVND(card.commissionAmount)}</Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Col:SoldAt")}>{formatDateTime(card.soldAt)}</Descriptions.Item>
            <Descriptions.Item label={t("PrepaidCard:Field:Note")}>{card.note ?? "—"}</Descriptions.Item>
          </Descriptions>

          <h4 className="prepaid-section-title">{t("PrepaidCard:Field:Members")}</h4>
          <CardMembersEditor
            card={card}
            saving={actions.savingMembers}
            onSave={actions.onSaveMembers ? (ids) => actions.onSaveMembers?.(card, ids) : undefined}
          />

          <h4 className="prepaid-section-title">{t("PrepaidCard:Detail:Ledger")}</h4>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
            dataSource={card.transactions}
            columns={ledgerColumns()}
          />
        </div>
      )}
    </Drawer>
  );
}
