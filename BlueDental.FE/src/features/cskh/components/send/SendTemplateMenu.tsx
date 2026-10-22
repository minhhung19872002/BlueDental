import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { foldForSearch } from "@/utils/foldForSearch";
import type { CareType } from "../../api/careApi";
import { TEMPLATE_STATUS, type MessageTemplateDto } from "../../api/templateApi";
import { CARE_TABS } from "../../careTabs";
import { purposeLabel } from "../templates/templateLook";
import { TemplateStatusBadge } from "../templates/TemplateStatusBadge";

type PurposeKey = CareType | "none";

const keyOf = (purpose: CareType | null): PurposeKey => purpose ?? "none";
const labelOf = (key: PurposeKey) => purposeLabel(key === "none" ? null : key);

/** Mục đích in the CSKH tab order, untagged templates last. */
const PURPOSE_ORDER: readonly PurposeKey[] = [...CARE_TABS.map((tab) => tab.type), "none"];

function noteOf(template: MessageTemplateDto): string {
  if (template.status === TEMPLATE_STATUS.Ready) return t("CSKH:Send:SentCount", template.sentCount);
  if (template.status === TEMPLATE_STATUS.PendingApproval) return t("CSKH:Send:Note:Pending");
  return t("CSKH:Send:Note:Draft");
}

interface SendTemplateMenuProps {
  templates: readonly MessageTemplateDto[];
  selectedId: string | null;
  channelName: string;
  listPath: string;
  onPick: (id: string) => void;
}

function TemplateOption({ template, selected, onPick }: {
  template: MessageTemplateDto;
  selected: boolean;
  onPick: (id: string) => void;
}) {
  const usable = template.status === TEMPLATE_STATUS.Ready;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-disabled={!usable}
      className={["snd-option", selected && "snd-option--selected"].filter(Boolean).join(" ")}
      onClick={() => usable && onPick(template.id)}
    >
      <span className="snd-option-body">
        <span className="snd-option-name">{template.name}</span>
        <span className="snd-option-meta">
          <span className="snd-option-purpose">
            {t("CSKH:Send:PurposeLabel")} {purposeLabel(template.purpose)}
          </span>
          {noteOf(template)}
        </span>
      </span>
      <TemplateStatusBadge status={template.status} />
      <span className="snd-option-tick" aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
    </button>
  );
}

/** The pop-down of step 2: search, Mục đích pills, the templates grouped by purpose. */
export function SendTemplateMenu({ templates, selectedId, channelName, listPath, onPick }: SendTemplateMenuProps) {
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState<PurposeKey | "all">("all");

  const purposes = PURPOSE_ORDER.filter((key) => templates.some((item) => keyOf(item.purpose) === key));
  const groups = useMemo(() => {
    const folded = foldForSearch(query.trim());
    const matching = templates.filter((item) => !folded || foldForSearch(item.name).includes(folded));
    return PURPOSE_ORDER.filter((key) => purpose === "all" || purpose === key)
      .map((key) => ({ key, items: matching.filter((item) => keyOf(item.purpose) === key) }))
      .filter((group) => group.items.length > 0);
  }, [templates, query, purpose]);

  const pill = (key: PurposeKey | "all", label: string, count: number) => (
    <button
      key={key}
      type="button"
      aria-pressed={purpose === key}
      className={["snd-pill", purpose === key && "snd-pill--on"].filter(Boolean).join(" ")}
      onClick={() => setPurpose(key)}
    >
      {label} <span className="snd-pill-count">{count}</span>
    </button>
  );

  return (
    <div className="snd-menu">
      <label className="snd-menu-search">
        <SearchOutlined aria-hidden="true" />
        <input
          type="search"
          value={query}
          aria-label={t("CSKH:Send:SearchTemplate", channelName)}
          placeholder={t("CSKH:Send:SearchTemplate", channelName)}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="snd-menu-purposes">
        <span className="tpl-eyebrow">{t("CSKH:Send:PurposeFilter")}</span>
        <div role="group" aria-label={t("CSKH:Send:PurposeFilter")} className="snd-pills">
          {pill("all", t("CSKH:Send:AllPurposes"), templates.length)}
          {purposes.map((key) =>
            pill(key, labelOf(key), templates.filter((item) => keyOf(item.purpose) === key).length),
          )}
        </div>
      </div>
      <div role="listbox" aria-label={t("CSKH:Send:TemplateOf", channelName)} className="snd-menu-list">
        {groups.length === 0 && (
          <p className="snd-menu-empty">
            {templates.length === 0 ? t("CSKH:Send:NoTemplateOf", channelName) : t("CSKH:Send:NoTemplateMatch")}
          </p>
        )}
        {groups.map((group) => (
          <div key={group.key} role="group" aria-label={labelOf(group.key)}>
            <span className="snd-menu-group">{labelOf(group.key)}</span>
            {group.items.map((item) => (
              <TemplateOption key={item.id} template={item} selected={item.id === selectedId} onPick={onPick} />
            ))}
          </div>
        ))}
      </div>
      <div className="snd-menu-foot">
        <span>{t("CSKH:Send:MenuFooter")}</span>
        <Link to={listPath}>{t("CSKH:Send:OpenTemplateList")}</Link>
      </div>
    </div>
  );
}
