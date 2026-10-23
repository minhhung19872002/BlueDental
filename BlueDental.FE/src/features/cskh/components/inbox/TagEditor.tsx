import { useRef, useState } from "react";
import { AutoComplete, Button } from "antd";
import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { foldForSearch } from "@/utils/foldForSearch";
import { INBOX_LIMITS, useSetTags, useTagSuggestions } from "../../api/inboxApi";

interface Props {
  conversationId: string;
  tags: string[];
  canEdit: boolean;
}

/**
 * "+ Tag" (BA P2210: "Cái tag này cho nhập free text"): any text, Enter adds
 * it; tags already used in the branch's inbox are offered as you type. Each
 * add or remove is saved at once.
 */
export function TagEditor({ conversationId, tags, canEdit }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  // Picking an option with Enter fires both onSelect and onKeyDown: one box, one tag.
  const doneRef = useRef(false);
  const save = useSetTags();
  const suggestions = useTagSuggestions(adding);

  const wanted = foldForSearch(draft.trim());
  const options = (suggestions.data ?? [])
    .filter((tag) => !tags.includes(tag) && (!wanted || foldForSearch(tag).includes(wanted)))
    .slice(0, 8)
    .map((tag) => ({ value: tag }));

  const commit = (next: string[]) => save.mutate({ id: conversationId, tags: next });

  const open = () => {
    doneRef.current = false;
    setDraft("");
    setAdding(true);
  };

  const close = () => {
    doneRef.current = true;
    setAdding(false);
  };

  const handleAdd = (value: string) => {
    if (doneRef.current) return;
    close();
    const tag = value.trim();
    if (tag && !tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) commit([...tags, tag]);
  };

  return (
    <div className="ibx-tags" aria-label={t("CSKH:Inbox:Tags")}>
      {tags.map((tag) => (
        <span key={tag} className="ibx-tag">
          {tag}
          {canEdit && (
            <button
              type="button"
              className="ibx-tag-remove"
              aria-label={t("CSKH:Inbox:TagRemove", tag)}
              disabled={save.isPending}
              onClick={() => commit(tags.filter((existing) => existing !== tag))}
            >
              <CloseOutlined />
            </button>
          )}
        </span>
      ))}
      {canEdit && adding && (
        <AutoComplete
          autoFocus
          size="small"
          className="ibx-tag-input"
          aria-label={t("CSKH:Inbox:TagNew")}
          placeholder={t("CSKH:Inbox:TagNew")}
          maxLength={INBOX_LIMITS.tag}
          value={draft}
          options={options}
          onChange={setDraft}
          onSelect={handleAdd}
          onBlur={close}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd(draft);
            if (event.key === "Escape") close();
          }}
        />
      )}
      {canEdit && !adding && tags.length < INBOX_LIMITS.tags && (
        <Button size="small" className="ibx-tag-add" icon={<PlusOutlined />} onClick={open}>
          {t("CSKH:Inbox:TagAdd")}
        </Button>
      )}
    </div>
  );
}
