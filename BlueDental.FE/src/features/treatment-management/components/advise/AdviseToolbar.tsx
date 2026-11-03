import { useEffect, useRef, type ReactNode } from "react";
import { Input, type InputRef } from "antd";
import { Search } from "lucide-react";
import { t } from "@/lib/i18n";
import type { AdviseKind } from "./adviseTypes";

interface Props {
  kind: AdviseKind;
  search: string;
  onlyPicked: boolean;
  /** How many rows the list holds for the group and search. */
  count: number;
  onSearchChange: (search: string) => void;
  onOnlyPickedChange: (onlyPicked: boolean) => void;
  /** "Thêm dịch vụ" / "Thêm combo" (BA #34); absent without the right. */
  action?: ReactNode;
}

/** A key typed into a field is the field's, not the shortcut's. */
function typingIn(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/**
 * The bar over the list of "Chọn dịch vụ" (P0111_02, R-1114): the search —
 * "/" jumps to it — "Chỉ xem đã chọn", the quick add and the row count.
 */
export function AdviseToolbar({ kind, search, onlyPicked, count, onSearchChange, onOnlyPickedChange, action }: Props) {
  const inputRef = useRef<InputRef>(null);
  const combo = kind === "combo";
  const placeholder = combo ? t("Treatment:Advise:SearchCombo") : t("Treatment:Advise:SearchServiceLong");

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || typingIn(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="am-toolbar">
      <Input
        ref={inputRef}
        className="am-search"
        allowClear
        prefix={<Search size={16} />}
        suffix={<kbd className="am-kbd" title={t("Treatment:Advise:SearchShortcut")}>/</kbd>}
        placeholder={placeholder}
        aria-label={placeholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <button
        type="button"
        className={onlyPicked ? "am-tool-btn active" : "am-tool-btn"}
        aria-pressed={onlyPicked}
        onClick={() => onOnlyPickedChange(!onlyPicked)}
      >
        {t("Treatment:Advise:OnlyPicked")}
      </button>
      {action}
      <span className="am-count">
        {combo ? t("Treatment:Advise:ComboCount", count) : t("Treatment:Advise:ServiceCount", count)}
      </span>
    </div>
  );
}
