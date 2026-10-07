import { useState } from "react";
import { Button, Input, Popover } from "antd";
import { FolderOpenOutlined, SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props {
  onBrowse: () => void;
}

/**
 * "Gõ mã ICD-10, tên bệnh hoặc số răng để thêm…" — UI only for now (F-58):
 * BlueDental has no ICD-10 catalog yet, so typing only says so and offers to
 * browse the treatment slips instead. UNKNOWN_REFERENCE_BEHAVIOR in
 * docs/clone/unknowns.md until the catalog exists.
 */
export function RxIcdSearch({ onBrowse }: Props) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const handleBrowse = () => {
    setQuery("");
    onBrowse();
  };

  const results = (
    <div className="rx-icd-results">
      <p className="rx-icd-empty">{t("Treatment:Rx:IcdNotLinked")}</p>
      <Button
        type="link"
        size="small"
        icon={<FolderOpenOutlined />}
        className="rx-icd-browse"
        // Keeps the input focused long enough for the click to land.
        onMouseDown={(event) => event.preventDefault()}
        onClick={handleBrowse}
      >
        {t("Treatment:Rx:IcdBrowse")}
      </Button>
    </div>
  );

  return (
    <Popover
      open={focused && query.trim().length > 0}
      content={results}
      placement="bottomLeft"
      arrow={false}
      classNames={{ root: "rx-icd-popover" }}
    >
      <Input
        className="rx-icd-search"
        prefix={<SearchOutlined />}
        placeholder={t("Treatment:Rx:IcdSearch")}
        aria-label={t("Treatment:Rx:IcdSearch")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </Popover>
  );
}
