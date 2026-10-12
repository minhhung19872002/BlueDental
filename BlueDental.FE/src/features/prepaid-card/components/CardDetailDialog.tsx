import { Descriptions, Modal, Spin, Table } from "antd";
import { t } from "@/lib/i18n";
import { formatDate, formatDateTime, formatVND } from "@/utils/format";
import { CARD_STATUS, type CardDetailDto } from "../types";
import { CardDetailFooter, type CardDetailActions } from "./CardDetailFooter";
import { usesText } from "./cardColumns";
import { CardMembersEditor } from "./CardMembersEditor";
import { CardStateTag } from "./CardStateTag";
import { ledgerColumns } from "./ledgerColumns";
import { scopeSummary } from "./ServiceScopeFields";

interface Props {
  open: boolean;
  card: CardDetailDto | undefined;
  loading: boolean;
  actions: CardDetailActions;
  onClose: () => void;
}

/** The card's terms and figures, two to a row. */
function CardFacts({ card }: { card: CardDetailDto }) {
  return (
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
      <Descriptions.Item label={t("PrepaidCard:Col:ExpiresOn")}>
        {card.expiresOn ? formatDate(card.expiresOn) : t("PrepaidCard:NoExpiry")}
      </Descriptions.Item>
      {card.cancelReason ? (
        <Descriptions.Item label={t("PrepaidCard:Cancel:Reason")}>{card.cancelReason}</Descriptions.Item>
      ) : null}
      <Descriptions.Item label={t("PrepaidCard:Field:Note")}>{card.note ?? "—"}</Descriptions.Item>
    </Descriptions>
  );
}

/** One card: its terms, who may spend it, and every movement of its balance. */
export function CardDetailDialog({ open, card, loading, actions, onClose }: Props) {
  const cancelled = card?.status === CARD_STATUS.Cancelled;

  return (
    <Modal
      open={open}
      width="min(1040px, calc(100vw - 32px))"
      className="app-dialog prepaid-dialog prepaid-detail-dialog"
      title={card ? `${card.code} · ${card.name}` : t("PrepaidCard:Detail:Title")}
      onCancel={onClose}
      destroyOnHidden
      footer={<CardDetailFooter card={card} actions={actions} onClose={onClose} />}
    >
      {loading || !card ? (
        <div className="prepaid-detail-loading">
          <Spin />
        </div>
      ) : (
        <div className="prepaid-detail">
          <CardFacts card={card} />

          <h4 className="prepaid-section-title">{t("PrepaidCard:Field:Members")}</h4>
          <CardMembersEditor
            card={card}
            saving={actions.savingMembers}
            onSave={actions.onSaveMembers && !cancelled ? (input) => actions.onSaveMembers?.(card, input) : undefined}
          />

          <h4 className="prepaid-section-title">{t("PrepaidCard:Detail:Ledger")}</h4>
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 900, y: 320 }}
            dataSource={card.transactions}
            columns={ledgerColumns()}
          />
        </div>
      )}
    </Modal>
  );
}
