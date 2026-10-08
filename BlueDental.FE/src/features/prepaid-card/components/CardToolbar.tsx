import { Button, Input, Select } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { CARD_STATE, type CardState, type CardTypeDto } from "../types";
import { cardStateConfig } from "./CardStateTag";

interface Props {
  keyword: string;
  state: CardState | undefined;
  cardTypeId: string | undefined;
  types: CardTypeDto[];
  onKeywordChange: (value: string) => void;
  onStateChange: (value: CardState | undefined) => void;
  onCardTypeChange: (value: string | undefined) => void;
  /** Left out when the account may not sell cards. */
  onSell?: () => void;
}

/** Search by card number or owner, filter by status and type, and "Bán thẻ". */
export function CardToolbar({
  keyword,
  state,
  cardTypeId,
  types,
  onKeywordChange,
  onStateChange,
  onCardTypeChange,
  onSell,
}: Props) {
  const states = cardStateConfig();

  return (
    <div className="prepaid-toolbar">
      <div className="prepaid-toolbar__filters">
        <Input
          allowClear
          value={keyword}
          prefix={<SearchOutlined />}
          className="prepaid-search"
          placeholder={t("PrepaidCard:SearchPlaceholder")}
          aria-label={t("PrepaidCard:SearchPlaceholder")}
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        <Select<CardState>
          allowClear
          value={state}
          className="prepaid-filter"
          placeholder={t("PrepaidCard:Filter:State")}
          aria-label={t("PrepaidCard:Filter:State")}
          onChange={(value) => onStateChange(value ?? undefined)}
          options={Object.values(CARD_STATE).map((value) => ({ value, label: states[value].label }))}
        />
        <Select<string>
          allowClear
          showSearch
          optionFilterProp="label"
          value={cardTypeId}
          className="prepaid-filter"
          placeholder={t("PrepaidCard:Filter:Type")}
          aria-label={t("PrepaidCard:Filter:Type")}
          onChange={(value) => onCardTypeChange(value ?? undefined)}
          options={types.map((type) => ({ value: type.id, label: type.name }))}
        />
      </div>
      {onSell ? (
        <Button type="primary" icon={<PlusOutlined />} onClick={onSell}>
          {t("PrepaidCard:Sell:Title")}
        </Button>
      ) : null}
    </div>
  );
}
